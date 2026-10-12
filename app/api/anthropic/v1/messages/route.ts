import { NextRequest } from "next/server";
import { recordUsage } from "@/lib/billing";
import { USD_CNY } from "@/lib/currency";
import { checkAccount } from "@/lib/guard";
import { claudeCost, claudePrice, ClaudeUsage } from "@/lib/claude-pricing";
import { aErr, authAnthropic, emptyUsage, mergeUsage, passHeaders, upstreamHeaders, upstreamUrl } from "@/lib/anthropic-gateway";

export const runtime = "nodejs";
export const maxDuration = 300; // Claude Code 的长任务流式可持续数分钟

// Claude Code 入口：POST /api/anthropic/v1/messages（Claude Code 会带 ?beta=true）
// 设置 ANTHROPIC_BASE_URL=https://<书童域名>/api/anthropic 与 ANTHROPIC_AUTH_TOKEN=sk-gw-...
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const auth = await authAnthropic(req);
  if (!auth) return aErr(401, "authentication_error", "Invalid ShuTong API key (sk-gw-...)");
  const blocked = await checkAccount(auth.user);
  if (blocked) return aErr(blocked.status, blocked.type, blocked.message);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_RELAY_TOKEN) return aErr(503, "api_error", "Claude upstream is not configured");

  const raw = await req.text(); // 原文转发，不重新序列化
  let meta: { model?: string; stream?: boolean };
  try { meta = JSON.parse(raw); } catch { return aErr(400, "invalid_request_error", "Invalid JSON body"); }
  const priced = meta.model ? claudePrice(meta.model) : null;
  if (!priced) return aErr(400, "invalid_request_error", `Model not available on ShuTong: ${meta.model ?? "(missing)"}`);

  let res: Response;
  try {
    res = await fetch(upstreamUrl("/messages", req.nextUrl.search), { method: "POST", headers: upstreamHeaders(req), body: raw });
  } catch (e: any) {
    return aErr(502, "api_error", `Upstream unreachable: ${e.message}`);
  }
  // 上游错误：状态码与错误体原样回传（Claude Code 依赖原始措辞做自动重试），不计费
  if (!res.ok || !res.body) return new Response(res.body, { status: res.status, headers: passHeaders(res) });

  const bill = async (u: ClaudeUsage) => {
    if (!u.input_tokens && !u.output_tokens && !u.cache_creation_input_tokens && !u.cache_read_input_tokens) return;
    const c = claudeCost(priced.key, priced.price, u);
    await recordUsage({
      userId: auth.user.id, apiKeyId: auth.key.id, modelId: meta.model!, status: "ok", latencyMs: Date.now() - t0,
      usage: { prompt_tokens: c.promptTotal, completion_tokens: u.output_tokens, total_tokens: c.promptTotal + u.output_tokens },
      chargeCny: c.charge * USD_CNY, upstreamCny: c.upstream * USD_CNY,
    }).catch((e) => console.error("[claude-code] billing failed:", e.message));
  };

  // 非流式：读出用量后原文返回
  if (!meta.stream) {
    const text = await res.text();
    const usage = emptyUsage();
    try { mergeUsage(usage, JSON.parse(text).usage); } catch {}
    await bill(usage);
    return new Response(text, { status: res.status, headers: passHeaders(res) });
  }

  // 流式：字节原样透传（不缓冲、保留 ping），旁路解析 message_start / message_delta 的用量
  const usage = emptyUsage();
  const decoder = new TextDecoder();
  let buffer = "";
  const scan = (line: string) => {
    if (!line.startsWith("data:")) return;
    try {
      const ev = JSON.parse(line.slice(5).trim());
      if (ev.type === "message_start") mergeUsage(usage, ev.message?.usage);
      else if (ev.type === "message_delta") mergeUsage(usage, ev.usage);
    } catch {}
  };
  const metered = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(scan);
    },
    async flush() {
      if (buffer) scan(buffer);
      await bill(usage);
    },
  }));
  return new Response(metered, { status: res.status, headers: passHeaders(res) });
}

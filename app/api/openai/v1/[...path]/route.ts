import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/apikey";
import { recordUsage } from "@/lib/billing";
import { USD_CNY } from "@/lib/currency";
import { checkAccount } from "@/lib/guard";
import { CODEX_MODELS, openaiCost, openaiPrice, ResponsesUsage } from "@/lib/openai-pricing";

export const runtime = "nodejs";
export const maxDuration = 300; // Codex 的长任务流式可持续数分钟

// Codex 入口（OpenAI Responses 格式）：
//   POST /api/openai/v1/responses           对话（流式 / 非流式）
//   POST /api/openai/v1/responses/compact   上下文压缩
//   GET  /api/openai/v1/models              模型列表
// Codex 配置 base_url = https://<书童域名>/api/openai/v1，env_key 指向书童密钥（sk-gw-...）
// 原则：请求体原文转发、响应字节原样回传，只在旁路读取用量计费

const oErr = (status: number, message: string, type = "invalid_request_error", code: string | null = null) =>
  Response.json({ error: { message, type, param: null, code } }, { status });

const upstreamBase = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const BILLED = new Set(["responses", "responses/compact"]);
// 不转发给上游的请求头（鉴权换成平台密钥，其余与连接相关）
const DROP = new Set(["authorization", "host", "cookie", "content-length", "connection", "accept-encoding", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip", "x-vercel-id"]);

function passHeaders(res: Response) {
  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (k === "content-type" || k === "retry-after" || k === "x-request-id" || k.startsWith("x-ratelimit") || k.startsWith("openai-")) out.set(k, v);
  });
  if (!out.has("content-type")) out.set("content-type", "application/json");
  out.set("cache-control", "no-cache");
  return out;
}

function readUsage(u: any): ResponsesUsage | null {
  if (!u || typeof u.input_tokens !== "number") return null;
  return { input_tokens: u.input_tokens, cached_tokens: u.input_tokens_details?.cached_tokens ?? 0, output_tokens: u.output_tokens ?? 0 };
}

async function auth(req: NextRequest) {
  return authenticateApiKey(req.headers.get("authorization"));
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (params.path.join("/") !== "models") return oErr(404, "Not found", "invalid_request_error", "not_found");
  if (!(await auth(req))) return oErr(401, "Invalid ShuTong API key (sk-gw-...)", "invalid_request_error", "invalid_api_key");
  return Response.json({ object: "list", data: CODEX_MODELS.map((m) => ({ id: m.id, object: "model", created: 1767225600, owned_by: "openai" })) });
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const t0 = Date.now();
  const path = params.path.join("/");
  if (!BILLED.has(path)) return oErr(404, `Endpoint not available on ShuTong: /${path}`, "invalid_request_error", "not_found");

  const a = await auth(req);
  if (!a) return oErr(401, "Invalid ShuTong API key (sk-gw-...)", "invalid_request_error", "invalid_api_key");
  const blocked = await checkAccount(a.user);
  if (blocked) return oErr(blocked.status, blocked.message, blocked.status === 402 ? "insufficient_quota" : blocked.type, blocked.status === 402 ? "insufficient_quota" : null);
  if (!process.env.OPENAI_API_KEY) return oErr(503, "OpenAI upstream is not configured", "server_error");

  const raw = await req.text(); // 原文转发，不重新序列化
  let meta: { model?: string; stream?: boolean };
  try { meta = JSON.parse(raw); } catch { return oErr(400, "Invalid JSON body"); }
  const priced = meta.model ? openaiPrice(meta.model) : null;
  if (!priced) return oErr(400, `Model not available on ShuTong: ${meta.model ?? "(missing)"}. Available: ${CODEX_MODELS.map((m) => m.id).join(", ")}`, "invalid_request_error", "model_not_found");

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { if (!DROP.has(k) && !k.startsWith("x-vercel") && !k.startsWith("x-forwarded") && k !== "forwarded") headers[k] = v; });
  headers["authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
  headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${upstreamBase()}/${path}${req.nextUrl.search}`, { method: "POST", headers, body: raw });
  } catch (e: any) {
    console.error("[codex] upstream unreachable:", e.message);
    return oErr(502, "Upstream model service unreachable, please retry", "server_error");
  }
  if (!res.ok || !res.body) {
    const body = await res.text();
    console.error(`[codex] ${meta.model} upstream ${res.status}:`, body.slice(0, 300));
    // 平台侧鉴权或额度问题不暴露给用户；其余错误（参数错误、限流等）原样回传，Codex 依赖它做重试与提示
    if (res.status === 401 || res.status === 403 || /insufficient_quota|billing/i.test(body)) {
      return oErr(503, `Model temporarily unavailable: ${meta.model}`, "server_error");
    }
    return new Response(body, { status: res.status, headers: passHeaders(res) });
  }

  const bill = async (u: ResponsesUsage | null) => {
    if (!u || (!u.input_tokens && !u.output_tokens)) return;
    const c = openaiCost(priced.price, u);
    await recordUsage({
      userId: a.user.id, apiKeyId: a.key.id, modelId: meta.model!, status: "ok", latencyMs: Date.now() - t0,
      usage: { prompt_tokens: u.input_tokens, completion_tokens: u.output_tokens, total_tokens: u.input_tokens + u.output_tokens },
      chargeCny: c.charge * USD_CNY, upstreamCny: c.upstream * USD_CNY,
    }).catch((e) => console.error("[codex] billing failed:", e.message));
  };

  const isStream = (res.headers.get("content-type") || "").includes("text/event-stream");
  if (!isStream) {
    const text = await res.text();
    let u: ResponsesUsage | null = null;
    try { const j = JSON.parse(text); u = readUsage(j.usage ?? j.response?.usage); } catch {}
    await bill(u);
    return new Response(text, { status: res.status, headers: passHeaders(res) });
  }

  // 流式：字节原样透传，旁路解析 response.completed / incomplete / failed 事件里的最终用量
  let usage: ResponsesUsage | null = null;
  const decoder = new TextDecoder();
  let buffer = "";
  const scan = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data.includes('"usage"')) return;
    try {
      const ev = JSON.parse(data);
      const u = readUsage(ev.response?.usage ?? ev.usage);
      if (u) usage = u;
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

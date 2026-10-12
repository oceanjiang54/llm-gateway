import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { providers } from "@/lib/providers";
import { recordUsage } from "@/lib/billing";
import { checkAccount } from "@/lib/guard";
import { buildMessages, maybeCompress, resolveConversation, saveTurn } from "@/lib/memory";
import { ChatMessage, ChatRequest, Usage } from "@/lib/providers/types";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel 免费版（Fluid compute）上限，长回答流式不中断

// 统一网关：OpenAI 兼容的 POST /api/v1/chat/completions
// 流程：鉴权 → 查额度 → 路由到上游 → （流式）转发 → 计量扣费
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  // 1. API Key 鉴权
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: { message: "Invalid API key", type: "auth_error" } }, { status: 401 });
  }

  // 2. 账户状态与额度检查（封禁 / 余额 / 每日限额）
  const blocked = await checkAccount(auth.user);
  if (blocked) {
    const legacyType = blocked.status === 403 ? "auth_error" : "billing_error";
    return NextResponse.json({ error: { message: blocked.message, type: legacyType } }, { status: blocked.status });
  }

  // 3. 解析请求并路由到对应模型
  let body: ChatRequest & { conversation_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body", type: "invalid_request" } }, { status: 400 });
  }
  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: { message: "`model` and `messages` are required", type: "invalid_request" } }, { status: 400 });
  }

  const model = (await db.select().from(schema.models).where(eq(schema.models.id, body.model)))[0];
  if (!model || !model.enabled) {
    return NextResponse.json({ error: { message: `Model not found: ${body.model}`, type: "invalid_request" } }, { status: 404 });
  }
  const provider = providers[model.provider];
  if (!provider || (provider.configured && !provider.configured())) {
    return NextResponse.json({ error: { message: `Model temporarily unavailable: ${body.model}`, type: "upstream_unconfigured" } }, { status: 503 });
  }

  // 4. 平台记忆（可选）：带 conversation_id 时由网关拼接摘要与历史，客户端只发新消息
  const incoming: ChatMessage[] = body.messages;
  let conv = null as Awaited<ReturnType<typeof resolveConversation>>;
  if (body.conversation_id !== undefined) {
    if (typeof body.conversation_id !== "string" || !body.conversation_id) {
      return NextResponse.json({ error: { message: "`conversation_id` must be \"new\" or an existing conversation id", type: "invalid_request" } }, { status: 400 });
    }
    conv = await resolveConversation(auth.user.id, body.conversation_id);
    if (!conv) {
      return NextResponse.json({ error: { message: `Conversation not found: ${body.conversation_id}`, type: "invalid_request" } }, { status: 404 });
    }
    conv = await maybeCompress(conv, { userId: auth.user.id, apiKeyId: auth.key.id }, model);
    body.messages = await buildMessages(conv, incoming);
  }
  const { conversation_id: _omit, ...upstreamBody } = body;

  // 5. 计量入账（流式与非流式共用）
  let promptTokens = 0;
  const settle = async (usage: Usage, status: "ok" | "error") => {
    promptTokens = usage.prompt_tokens;
    await recordUsage({ userId: auth.user.id, apiKeyId: auth.key.id, model, usage, status, latencyMs: Date.now() - t0 });
  };
  const convHeaders: Record<string, string> = conv ? { "x-conversation-id": conv.id } : {};

  try {
    if (body.stream) {
      const upstream = await provider.chatStream(model.upstreamId, upstreamBody, (u) => settle(u, "ok"));
      const out = conv ? withMemory(upstream, conv.id, async (answer) => {
        await saveTurn(conv!, incoming, answer, promptTokens, model.id).catch((e) => console.error("[memory] save failed:", e.message));
      }) : upstream;
      return new Response(out, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...convHeaders },
      });
    }

    const result = await provider.chat(model.upstreamId, upstreamBody);
    await settle(result.usage, "ok");
    if (conv) await saveTurn(conv, incoming, result.content, result.usage.prompt_tokens, model.id);

    // 返回标准 OpenAI 格式（启用记忆时多一个 conversation_id 字段）
    return NextResponse.json({
      id: "chatcmpl-" + randomUUID().slice(0, 12),
      object: "chat.completion",
      created: Math.floor(t0 / 1000),
      model: model.id,
      ...(conv ? { conversation_id: conv.id } : {}),
      choices: [{ index: 0, message: { role: "assistant", content: result.content }, finish_reason: "stop" }],
      usage: result.usage,
    }, { headers: convHeaders });
  } catch (e: any) {
    await settle({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, "error").catch(() => {});
    // 上游原始报错只写服务端日志，不透传给调用方（避免把平台侧配置问题误认为是用户密钥问题）
    console.error(`[gateway] ${model.id} upstream error:`, e.message);
    const up = Number(/upstream (\d{3})/.exec(e.message ?? "")?.[1] || 0);
    // 上游账户额度/余额用尽（如 Moonshot exceeded_current_quota_error）：属于平台侧问题，按「暂不可用」处理
    if (/quota|insufficient|balance|billing|欠费|余额/i.test(e.message ?? "")) {
      return NextResponse.json({ error: { message: `Model temporarily unavailable: ${model.id}`, type: "upstream_unconfigured" } }, { status: 503, headers: convHeaders });
    }
    if (up === 429) {
      return NextResponse.json({ error: { message: `Model is busy, please retry later: ${model.id}`, type: "rate_limit_error" } }, { status: 429, headers: convHeaders });
    }
    if (up === 401 || up === 403) {
      return NextResponse.json({ error: { message: `Model temporarily unavailable: ${model.id}`, type: "upstream_unconfigured" } }, { status: 503, headers: convHeaders });
    }
    return NextResponse.json({ error: { message: `Upstream model service error${up ? ` (${up})` : ""}, please retry`, type: "upstream_error" } }, { status: 502, headers: convHeaders });
  }
}

// 流式包装：逐行透传，在每个数据块里附上 conversation_id，同时累积回答文本，结束后存档
function withMemory(src: ReadableStream<Uint8Array>, convId: string, onDone: (answer: string) => Promise<void>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let answer = "";
  const handle = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      try {
        const chunk = JSON.parse(line.slice(6));
        const d = chunk.choices?.[0]?.delta?.content;
        if (typeof d === "string") answer += d;
        chunk.conversation_id = convId;
        line = "data: " + JSON.stringify(chunk);
      } catch {}
    }
    controller.enqueue(encoder.encode(line + "\n"));
  };
  return src.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const l of lines) handle(l, controller);
    },
    async flush(controller) {
      if (buffer) handle(buffer, controller);
      await onDone(answer);
    },
  }));
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { providers } from "@/lib/providers";
import { calcCost } from "@/lib/pricing";
import { ChatRequest, Usage } from "@/lib/providers/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// 统一网关：OpenAI 兼容的 POST /api/v1/chat/completions
// 流程：鉴权 → 查额度 → 路由到上游 → （流式）转发 → 计量扣费
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  // 1. API Key 鉴权
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: { message: "Invalid API key", type: "auth_error" } }, { status: 401 });
  }

  // 2. 账户状态与额度检查
  if (auth.user.status === "banned") {
    return NextResponse.json({ error: { message: "Account suspended", type: "auth_error" } }, { status: 403 });
  }
  if (auth.user.balanceUsd <= 0) {
    return NextResponse.json({ error: { message: "Insufficient balance", type: "billing_error" } }, { status: 402 });
  }
  // 每日消费上限（管理员可设）
  if (auth.user.dailyLimitUsd != null) {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const spent = (await db.select({ s: sql<number>`coalesce(sum(cost_usd), 0)` })
      .from(schema.usageLogs)
      .where(and(eq(schema.usageLogs.userId, auth.user.id), gte(schema.usageLogs.createdAt, dayStart))))[0];
    if (Number(spent.s) >= auth.user.dailyLimitUsd) {
      return NextResponse.json({ error: { message: "Daily usage limit reached", type: "billing_error" } }, { status: 429 });
    }
  }

  // 3. 解析请求并路由到对应模型
  let body: ChatRequest;
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

  // 4. 计量入账（流式与非流式共用）：记日志 + 扣余额
  const settle = async (usage: Usage, status: "ok" | "error") => {
    const cost = calcCost(usage.prompt_tokens, usage.completion_tokens, model.inputPerM, model.outputPerM);
    const upstreamCost = calcCost(usage.prompt_tokens, usage.completion_tokens, model.upstreamInputPerM, model.upstreamOutputPerM);
    await db.insert(schema.usageLogs).values({
      id: randomUUID(),
      userId: auth.user.id,
      apiKeyId: auth.key.id,
      model: model.id,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      costUsd: cost,
      upstreamCostUsd: upstreamCost,
      latencyMs: Date.now() - t0,
      status,
      createdAt: new Date(),
    });
    await db.update(schema.users)
      .set({ balanceUsd: sql`${schema.users.balanceUsd} - ${cost}` })
      .where(eq(schema.users.id, auth.user.id));
  };

  try {
    if (body.stream) {
      const stream = await provider.chatStream(model.upstreamId, body, (u) => settle(u, "ok"));
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await provider.chat(model.upstreamId, body);
    await settle(result.usage, "ok");

    // 返回标准 OpenAI 格式
    return NextResponse.json({
      id: "chatcmpl-" + randomUUID().slice(0, 12),
      object: "chat.completion",
      created: Math.floor(t0 / 1000),
      model: model.id,
      choices: [{ index: 0, message: { role: "assistant", content: result.content }, finish_reason: "stop" }],
      usage: result.usage,
    });
  } catch (e: any) {
    await settle({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, "error").catch(() => {});
    return NextResponse.json({ error: { message: e.message ?? "Upstream error", type: "upstream_error" } }, { status: 502 });
  }
}

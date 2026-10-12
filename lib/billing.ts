import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { calcCost } from "./pricing";
import { USD_CNY } from "./currency";
import { Usage } from "./providers/types";

type ModelRow = typeof schema.models.$inferSelect;

// 记一笔用量并扣余额（人民币）：网关调用与记忆压缩共用
// 传 model 时：售价按模型表（元/百万），上游成本按美元单价 × 汇率；
// Claude Code 入口另算缓存读写，直接传 modelId + 已折成人民币的两个金额
export async function recordUsage(opts: {
  userId: string; apiKeyId: string; usage: Usage; status: string; latencyMs: number;
  model?: ModelRow; modelId?: string; chargeCny?: number; upstreamCny?: number;
}) {
  const { model, usage } = opts;
  const charge = opts.chargeCny ?? calcCost(usage.prompt_tokens, usage.completion_tokens, model!.inputPerM, model!.outputPerM);
  const upstream = opts.upstreamCny ?? calcCost(usage.prompt_tokens, usage.completion_tokens, model!.upstreamInputPerM, model!.upstreamOutputPerM) * USD_CNY;
  await db.insert(schema.usageLogs).values({
    id: randomUUID(),
    userId: opts.userId,
    apiKeyId: opts.apiKeyId,
    model: opts.modelId ?? model!.id,
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cost: charge,
    upstreamCost: upstream,
    latencyMs: opts.latencyMs,
    status: opts.status,
    createdAt: new Date(),
  });
  await db.update(schema.users)
    .set({ balance: sql`${schema.users.balance} - ${charge}` })
    .where(eq(schema.users.id, opts.userId));
}

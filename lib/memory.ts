import { and, asc, eq, inArray } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import { db, schema } from "./db";
import { providers } from "./providers";
import { ChatMessage } from "./providers/types";
import { recordUsage } from "./billing";

// 平台记忆：服务端按会话保存历史，客户端只发新问题
// 压缩策略：上一轮真实输入 token 超过阈值时，在下一轮开始前把较早的消息压缩成摘要，最近 KEEP 条保留原文
const THRESHOLD = Number(process.env.MEMORY_COMPRESS_TOKENS || 8000);
const KEEP = Math.max(2, Number(process.env.MEMORY_KEEP_MESSAGES || 6));
const SUMMARY_MODEL = process.env.MEMORY_SUMMARY_MODEL || "deepseek-chat";

type Conversation = typeof schema.conversations.$inferSelect;
type ModelRow = typeof schema.models.$inferSelect;

export const newConversationId = () => "conv_" + randomBytes(12).toString("hex");

// 取会话：只能取到本账号的；"new" 表示新建
export async function resolveConversation(userId: string, id: string): Promise<Conversation | null> {
  if (id === "new") {
    const now = new Date();
    const conv = { id: newConversationId(), userId, title: "", summary: "", model: "", lastPromptTokens: 0, createdAt: now, updatedAt: now };
    await db.insert(schema.conversations).values(conv);
    return conv;
  }
  const rows = await db.select().from(schema.conversations)
    .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId)));
  return rows[0] ?? null;
}

async function activeMessages(convId: string) {
  return db.select().from(schema.conversationMessages)
    .where(and(eq(schema.conversationMessages.conversationId, convId), eq(schema.conversationMessages.summarized, false)))
    .orderBy(asc(schema.conversationMessages.createdAt));
}

// 拼上下文：请求自带的 system → 历史摘要 → 未压缩的历史原文 → 本轮新消息
export async function buildMessages(conv: Conversation, incoming: ChatMessage[]): Promise<ChatMessage[]> {
  const system = incoming.filter((m) => m.role === "system");
  const fresh = incoming.filter((m) => m.role !== "system");
  const history = await activeMessages(conv.id);
  const out: ChatMessage[] = [...system];
  if (conv.summary) out.push({ role: "system", content: `以下是你与该用户此前对话的摘要，请在回答时参考：\n${conv.summary}` });
  for (const h of history) out.push({ role: h.role as ChatMessage["role"], content: h.content });
  return [...out, ...fresh];
}

// 保存一轮：本轮新消息 + 助手回答；记录本轮真实输入 token 供下次判断是否压缩
export async function saveTurn(conv: Conversation, incoming: ChatMessage[], answer: string, promptTokens: number, modelId: string) {
  const fresh = incoming.filter((m) => m.role !== "system");
  const t = Date.now();
  const rows = fresh.map((m, i) => ({
    id: randomUUID(), conversationId: conv.id, role: m.role, content: String(m.content ?? ""), summarized: false, createdAt: new Date(t + i),
  }));
  if (answer) rows.push({ id: randomUUID(), conversationId: conv.id, role: "assistant", content: answer, summarized: false, createdAt: new Date(t + fresh.length) });
  if (rows.length) await db.insert(schema.conversationMessages).values(rows);
  const firstUser = fresh.find((m) => m.role === "user");
  await db.update(schema.conversations).set({
    title: conv.title || String(firstUser?.content ?? "").replace(/\s+/g, " ").slice(0, 40),
    model: modelId,
    lastPromptTokens: promptTokens,
    updatedAt: new Date(),
  }).where(eq(schema.conversations.id, conv.id));
}

// 超阈值则压缩：失败不影响本次调用（只是上下文暂时更长）
export async function maybeCompress(conv: Conversation, owner: { userId: string; apiKeyId: string }, fallback: ModelRow) {
  if (conv.lastPromptTokens <= THRESHOLD) return conv;
  const history = await activeMessages(conv.id);
  if (history.length <= KEEP) return conv;
  const old = history.slice(0, history.length - KEEP);

  // 摘要模型：优先配置的便宜模型，其次本次调用的模型
  let summaryModel = fallback;
  const preferred = (await db.select().from(schema.models).where(eq(schema.models.id, SUMMARY_MODEL)))[0];
  const pp = preferred && providers[preferred.provider];
  if (preferred?.enabled && pp && (!pp.configured || pp.configured())) summaryModel = preferred;
  const provider = providers[summaryModel.provider];

  const transcript = old.map((m) => `${m.role === "user" ? "用户" : "助手"}：${m.content.slice(0, 4000)}`).join("\n\n");
  const t0 = Date.now();
  try {
    const r = await provider.chat(summaryModel.upstreamId, {
      model: summaryModel.id,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        { role: "system", content: "你是对话记忆压缩器。把对话压缩成供后续回答参考的摘要：保留用户身份与偏好、已确认的事实与数字、做出的决定、未解决的问题；去掉寒暄和重复。用中文要点列出，不超过 600 字，只输出摘要本身。" },
        { role: "user", content: `${conv.summary ? `已有摘要：\n${conv.summary}\n\n` : ""}需要并入摘要的新对话：\n${transcript}` },
      ],
    });
    const summary = r.content.trim();
    if (!summary) return conv;
    await db.update(schema.conversationMessages).set({ summarized: true })
      .where(inArray(schema.conversationMessages.id, old.map((m) => m.id)));
    await db.update(schema.conversations).set({ summary, lastPromptTokens: 0, updatedAt: new Date() })
      .where(eq(schema.conversations.id, conv.id));
    await recordUsage({ ...owner, model: summaryModel, usage: r.usage, status: "memory", latencyMs: Date.now() - t0 });
    return { ...conv, summary, lastPromptTokens: 0 };
  } catch (e) {
    console.error("[memory] compress failed:", (e as Error).message);
    return conv;
  }
}

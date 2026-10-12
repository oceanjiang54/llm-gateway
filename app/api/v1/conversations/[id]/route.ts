import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

export const dynamic = "force-dynamic";

async function own(req: NextRequest, id: string) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return { err: NextResponse.json({ error: { message: "Invalid API key", type: "auth_error" } }, { status: 401 }) };
  const conv = (await db.select().from(schema.conversations)
    .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, auth.user.id))))[0];
  if (!conv) return { err: NextResponse.json({ error: { message: `Conversation not found: ${id}`, type: "invalid_request" } }, { status: 404 }) };
  return { conv };
}

// 查看会话：摘要 + 全部消息（summarized=true 的已并入摘要，不再原文发送给模型）
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { err, conv } = await own(req, params.id);
  if (err) return err;
  const messages = await db.select({
    role: schema.conversationMessages.role, content: schema.conversationMessages.content,
    summarized: schema.conversationMessages.summarized, created_at: schema.conversationMessages.createdAt,
  }).from(schema.conversationMessages).where(eq(schema.conversationMessages.conversationId, conv!.id))
    .orderBy(asc(schema.conversationMessages.createdAt));
  return NextResponse.json({ id: conv!.id, title: conv!.title, model: conv!.model, summary: conv!.summary, messages });
}

// 删除会话及其全部消息
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { err, conv } = await own(req, params.id);
  if (err) return err;
  await db.delete(schema.conversationMessages).where(eq(schema.conversationMessages.conversationId, conv!.id));
  await db.delete(schema.conversations).where(eq(schema.conversations.id, conv!.id));
  return NextResponse.json({ deleted: true, id: conv!.id });
}

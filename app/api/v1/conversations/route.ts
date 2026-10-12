import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";

export const dynamic = "force-dynamic";

// 列出本账号的会话（最近更新在前）
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: { message: "Invalid API key", type: "auth_error" } }, { status: 401 });
  const rows = await db.select({
    id: schema.conversations.id, title: schema.conversations.title, model: schema.conversations.model,
    has_summary: schema.conversations.summary, created_at: schema.conversations.createdAt, updated_at: schema.conversations.updatedAt,
  }).from(schema.conversations).where(eq(schema.conversations.userId, auth.user.id))
    .orderBy(desc(schema.conversations.updatedAt)).limit(100);
  return NextResponse.json({ data: rows.map((r) => ({ ...r, has_summary: !!r.has_summary })) });
}

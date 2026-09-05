import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { generateApiKey } from "@/lib/apikey";

// 列出当前用户的 Key（不含明文）
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const keys = await db
    .select({
      id: schema.apiKeys.id, name: schema.apiKeys.name, prefix: schema.apiKeys.prefix,
      disabled: schema.apiKeys.disabled, createdAt: schema.apiKeys.createdAt, lastUsedAt: schema.apiKeys.lastUsedAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, userId))
    .orderBy(desc(schema.apiKeys.createdAt));
  return NextResponse.json({ keys });
}

// 创建新 Key：明文只在响应中出现一次
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { name } = await req.json().catch(() => ({ name: "default" }));
  const { raw, hash, prefix } = generateApiKey();
  await db.insert(schema.apiKeys).values({
    id: randomUUID(), userId, name: name || "default", keyHash: hash, prefix, createdAt: new Date(),
  });
  return NextResponse.json({ key: raw });
}

// 停用 Key
export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await req.json();
  await db.update(schema.apiKeys)
    .set({ disabled: true })
    .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, userId)));
  return NextResponse.json({ ok: true });
}

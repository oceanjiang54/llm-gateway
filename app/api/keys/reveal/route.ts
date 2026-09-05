import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

// 读取本人密钥原文（用于"开始调用"一键复制 curl）。仅限登录本人；旧密钥无原文时返回 null
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await req.json();
  const row = (await db.select({ secret: schema.apiKeys.keySecret, disabled: schema.apiKeys.disabled })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, userId))))[0];
  if (!row) return NextResponse.json({ error: "密钥不存在" }, { status: 404 });
  return NextResponse.json({ key: row.secret ?? null, disabled: row.disabled });
}

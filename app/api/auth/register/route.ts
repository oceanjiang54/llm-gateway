import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { consumeCode, isEmail, isCnPhone } from "@/lib/verify";

export async function POST(req: NextRequest) {
  const { account, password, code } = await req.json();
  const accountType = isEmail(account) ? "email" : isCnPhone(account) ? "phone" : null;
  if (!accountType) return NextResponse.json({ error: "请输入正确的邮箱或手机号" }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: "密码至少8位" }, { status: 400 });
  if (!code || !(await consumeCode(account, code))) {
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }
  const exists = (await db.select().from(schema.users).where(eq(schema.users.account, account)))[0];
  if (exists) return NextResponse.json({ error: "该账号已注册" }, { status: 409 });
  const id = randomUUID();
  await db.insert(schema.users).values({
    id, account, accountType, passwordHash: await bcrypt.hash(password, 10), balanceUsd: 5.0, createdAt: new Date(),
  });
  await createSession(id);
  return NextResponse.json({ ok: true });
}

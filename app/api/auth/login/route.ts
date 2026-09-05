import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { account, password } = await req.json();
  const user = (await db.select().from(schema.users).where(eq(schema.users.account, account)))[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}

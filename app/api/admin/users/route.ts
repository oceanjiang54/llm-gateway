import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// 用户列表（含消费聚合）
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "not found" }, { status: 404 });
  const users = await db.execute(sql`
    SELECT u.id, u.account, u.status, u.balance_usd, u.daily_limit_usd, u.created_at,
           coalesce(sum(l.cost_usd), 0) AS spent, count(l.id)::int AS calls
    FROM users u LEFT JOIN usage_logs l ON l.user_id = u.id
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200
  `);
  return NextResponse.json({ users });
}

// 管理操作：调整额度 / 封禁 / 解封 / 限制每日用量
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { id, action, value } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  if (action === "setBalance") {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "额度必须为非负数字" }, { status: 400 });
    await db.update(schema.users).set({ balanceUsd: v }).where(eq(schema.users.id, id));
  } else if (action === "ban") {
    await db.update(schema.users).set({ status: "banned" }).where(eq(schema.users.id, id));
  } else if (action === "unban") {
    await db.update(schema.users).set({ status: "active" }).where(eq(schema.users.id, id));
  } else if (action === "setDailyLimit") {
    // value 为空/0 时取消限制
    const v = value === null || value === "" ? null : Number(value);
    if (v !== null && (!Number.isFinite(v) || v < 0)) return NextResponse.json({ error: "限额必须为非负数字" }, { status: 400 });
    await db.update(schema.users).set({ dailyLimitUsd: v === 0 ? null : v }).where(eq(schema.users.id, id));
  } else {
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "./db";

type User = typeof schema.users.$inferSelect;

// 账户闸门：封禁 / 余额 / 每日限额。返回 null 表示放行
export async function checkAccount(user: User): Promise<{ status: number; type: string; message: string } | null> {
  if (user.status === "banned") return { status: 403, type: "permission_error", message: "Account suspended" };
  if (user.balance <= 0) return { status: 402, type: "billing_error", message: "Insufficient balance" };
  if (user.dailyLimit != null) {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const spent = (await db.select({ s: sql<number>`coalesce(sum(cost), 0)` }).from(schema.usageLogs)
      .where(and(eq(schema.usageLogs.userId, user.id), gte(schema.usageLogs.createdAt, dayStart))))[0];
    if (Number(spent.s) >= user.dailyLimit) return { status: 429, type: "rate_limit_error", message: "Daily usage limit reached" };
  }
  return null;
}

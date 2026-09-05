import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { getSessionUserId } from "./auth";

// 管理员判定：登录账号在 ADMIN_ACCOUNTS 环境变量中（逗号分隔）
export function isAdminAccount(account: string) {
  return (process.env.ADMIN_ACCOUNTS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    .includes(account.toLowerCase());
}

export async function requireAdmin() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
  if (!user || !isAdminAccount(user.account)) return null;
  return user;
}

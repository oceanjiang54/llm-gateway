import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

// 生成 sk-gw- 开头的密钥；数据库只存 SHA-256 哈希
export function generateApiKey() {
  const raw = "sk-gw-" + randomBytes(24).toString("hex");
  return { raw, hash: sha256(raw), prefix: raw.slice(0, 12) + "..." };
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

// 网关鉴权：从 Authorization: Bearer sk-gw-... 解析并校验，返回 key + 所属用户
export async function authenticateApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith("sk-gw-")) return null;

  const rows = await db
    .select({ key: schema.apiKeys, user: schema.users })
    .from(schema.apiKeys)
    .innerJoin(schema.users, eq(schema.apiKeys.userId, schema.users.id))
    .where(eq(schema.apiKeys.keyHash, sha256(raw)));

  const row = rows[0];
  if (!row || row.key.disabled) return null;
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, row.key.id))
    .catch(() => {}); // 异步更新最近使用时间，不阻塞请求
  return row;
}

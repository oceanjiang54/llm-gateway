import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Postgres（Supabase）连接：serverless 环境使用连接池 + 关闭 prepare（兼容 Supabase 事务池）
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 5,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : "require",
  });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };

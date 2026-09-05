// 一次性初始化/迁移：建表、补列、写入模型定价（上游价 + 30% 加价的用户价）
import { readFileSync, existsSync } from "fs";
import postgres from "postgres";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.DATABASE_URL) { console.error("缺少 DATABASE_URL"); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : "require",
});

await sql`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, account TEXT NOT NULL UNIQUE, account_type TEXT NOT NULL,
  password_hash TEXT NOT NULL, balance_usd DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  status TEXT NOT NULL DEFAULT 'active', daily_limit_usd DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL)`;
await sql`CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY, target TEXT NOT NULL, code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, used BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS idx_codes_target ON verification_codes(target, created_at)`;
await sql`CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'default',
  key_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL, last_used_at TIMESTAMPTZ)`;
await sql`CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, upstream_id TEXT NOT NULL, display_name TEXT NOT NULL,
  input_per_m DOUBLE PRECISION NOT NULL, output_per_m DOUBLE PRECISION NOT NULL,
  upstream_input_per_m DOUBLE PRECISION NOT NULL DEFAULT 0, upstream_output_per_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE)`;
await sql`CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, api_key_id TEXT NOT NULL, model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, cost_usd DOUBLE PRECISION NOT NULL,
  upstream_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_logs(user_id, created_at)`;

// 老库迁移：补列 + 清洗
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_limit_usd DOUBLE PRECISION`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS upstream_input_per_m DOUBLE PRECISION NOT NULL DEFAULT 0`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS upstream_output_per_m DOUBLE PRECISION NOT NULL DEFAULT 0`;
await sql`ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS upstream_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0`;
await sql`ALTER TABLE api_keys DROP COLUMN IF EXISTS key_secret`;

// 定价：MARKUP=1.3，用户价 = 上游价 × 1.3
const MARKUP = 1.3;
const models = [
  ["claude-sonnet-4-5", "anthropic", "claude-sonnet-4-5", "Claude Sonnet 4.5", 3.0, 15.0],
  ["claude-haiku-4-5", "anthropic", "claude-haiku-4-5-20251001", "Claude Haiku 4.5", 1.0, 5.0],
  ["deepseek-chat", "deepseek", "deepseek-chat", "DeepSeek V3", 0.27, 1.1],
];
for (const [id, provider, upstreamId, displayName, ui, uo] of models) {
  const [pi, po] = [Math.round(ui * MARKUP * 100) / 100, Math.round(uo * MARKUP * 100) / 100];
  await sql`INSERT INTO models (id, provider, upstream_id, display_name, input_per_m, output_per_m, upstream_input_per_m, upstream_output_per_m, enabled)
    VALUES (${id}, ${provider}, ${upstreamId}, ${displayName}, ${pi}, ${po}, ${ui}, ${uo}, TRUE)
    ON CONFLICT (id) DO UPDATE SET input_per_m = ${pi}, output_per_m = ${po}, upstream_input_per_m = ${ui}, upstream_output_per_m = ${uo}`;
}
console.log("数据库初始化完成：定价含 30% 加价（进账≠成本，毛利可计）");
await sql.end();

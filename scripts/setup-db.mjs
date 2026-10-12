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
  onnotice: () => {}, // 屏蔽「已存在，跳过」之类的提示，只保留真正的结果
  prepare: false,
  ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : "require",
});

await sql`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, account TEXT NOT NULL UNIQUE, account_type TEXT NOT NULL,
  password_hash TEXT NOT NULL, balance DOUBLE PRECISION NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active', daily_limit DOUBLE PRECISION,
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
  input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, cost DOUBLE PRECISION NOT NULL,
  upstream_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_logs(user_id, created_at)`;
await sql`CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_logs(created_at)`;

// 汇率与赠送额度（与 lib/currency.ts 保持一致）
const USD_CNY = Number(process.env.USD_CNY_RATE || 7.0);
const SIGNUP_BONUS_CNY = Number(process.env.SIGNUP_BONUS_CNY || 30);

// 美元列 → 人民币列：改名并按汇率换算一次。只在旧列存在时执行，重复运行不会二次换算
const hasCol = async (table, col) =>
  (await sql`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${col}`).length > 0;
for (const [table, oldCol, newCol] of [
  ["users", "balance_usd", "balance"],
  ["users", "daily_limit_usd", "daily_limit"],
  ["usage_logs", "cost_usd", "cost"],
  ["usage_logs", "upstream_cost_usd", "upstream_cost"],
]) {
  if (await hasCol(table, oldCol) && !(await hasCol(table, newCol))) {
    await sql.begin(async (tx) => {
      await tx`ALTER TABLE ${tx(table)} RENAME COLUMN ${tx(oldCol)} TO ${tx(newCol)}`;
      await tx`UPDATE ${tx(table)} SET ${tx(newCol)} = ${tx(newCol)} * ${USD_CNY} WHERE ${tx(newCol)} IS NOT NULL`;
    });
    console.log(`已换算为人民币：${table}.${oldCol} → ${newCol}（× ${USD_CNY}）`);
  }
}
await sql`ALTER TABLE users ALTER COLUMN balance SET DEFAULT ${sql.unsafe(String(SIGNUP_BONUS_CNY))}`;

// 老库迁移：补列 + 清洗
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_limit DOUBLE PRECISION`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS upstream_input_per_m DOUBLE PRECISION NOT NULL DEFAULT 0`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS upstream_output_per_m DOUBLE PRECISION NOT NULL DEFAULT 0`;
await sql`ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS upstream_cost DOUBLE PRECISION NOT NULL DEFAULT 0`;
await sql`ALTER TABLE api_keys DROP COLUMN IF EXISTS key_secret`;

// 模型元数据列 + 留资表
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS vendor TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '对话'`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'live'`;
await sql`ALTER TABLE models ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100`;
await sql`CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY, company TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'home', status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS idx_leads_time ON leads(created_at)`;

// 平台记忆
await sql`CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '', last_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at)`;
await sql`CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
  summarized BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL)`;
await sql`CREATE INDEX IF NOT EXISTS idx_convmsg ON conversation_messages(conversation_id, created_at)`;

// 定价：用户售价（元）= 上游美元价 × 汇率 × 1.3（上游价为各家国际站官方价，2026-10 核对）
const MARKUP = 1.3;
const r2 = (x) => Math.round(x * USD_CNY * MARKUP * 100) / 100;
// [id, provider, upstreamId, 名称, 上游入, 上游出, 厂商, 类型, 简介, 状态, 排序]
const models = [
  ["claude-sonnet-4-5", "anthropic", "claude-sonnet-4-5", "Claude Sonnet 4.5", 3.0, 15.0, "Anthropic", "旗舰 · 推理", "复杂推理、长文写作与代码的全能旗舰", "live", 10],
  ["claude-haiku-4-5", "anthropic", "claude-haiku-4-5-20251001", "Claude Haiku 4.5", 1.0, 5.0, "Anthropic", "轻快", "响应快、成本低，适合高频对话与分类", "live", 20],
  ["deepseek-chat", "deepseek", "deepseek-chat", "DeepSeek V3", 0.27, 1.1, "深度求索", "性价比", "中文能力强、价格极低的通用对话模型", "live", 30],
  ["qwen-max", "qwen", "qwen-max", "Qwen Max", 1.6, 6.4, "阿里通义", "旗舰", "通义千问旗舰，中文理解与复杂任务", "live", 40],
  ["qwen-plus", "qwen", "qwen-plus", "Qwen Plus", 0.4, 1.2, "阿里通义", "均衡", "效果与成本均衡，适合大多数业务场景", "live", 50],
  ["kimi-k2.6", "kimi", "kimi-k2.6", "Kimi K2.6", 0.95, 4.0, "月之暗面", "长文本 · Agent", "256K 超长上下文，擅长长文档与 Agent 任务", "live", 60],
  ["minimax", "minimax", "minimax", "MiniMax", 0, 0, "MiniMax", "多模态", "语音与多模态能力见长", "coming", 70],
  ["gpt", "openai", "gpt", "GPT", 0, 0, "OpenAI", "旗舰", "全球主流通用大模型", "coming", 80],
  ["gemini", "google", "gemini", "Gemini", 0, 0, "Google", "多模态 · 长文本", "超长上下文与多模态理解", "coming", 90],
];
for (const [id, provider, upstreamId, displayName, ui, uo, vendor, category, description, status, sortOrder] of models) {
  const [pi, po] = [r2(ui), r2(uo)];
  const enabled = status === "live";
  await sql`INSERT INTO models (id, provider, upstream_id, display_name, input_per_m, output_per_m, upstream_input_per_m, upstream_output_per_m, enabled, vendor, category, description, status, sort_order)
    VALUES (${id}, ${provider}, ${upstreamId}, ${displayName}, ${pi}, ${po}, ${ui}, ${uo}, ${enabled}, ${vendor}, ${category}, ${description}, ${status}, ${sortOrder})
    ON CONFLICT (id) DO UPDATE SET provider = ${provider}, upstream_id = ${upstreamId}, display_name = ${displayName},
      input_per_m = ${pi}, output_per_m = ${po}, upstream_input_per_m = ${ui}, upstream_output_per_m = ${uo},
      enabled = ${enabled}, vendor = ${vendor}, category = ${category}, description = ${description}, status = ${status}, sort_order = ${sortOrder}`;
}
// 安全加固：开启 RLS 且不建策略 = 拒绝 Supabase 自动 REST API 访问；
// 应用以表所有者身份直连，天然绕过 RLS，业务不受影响
for (const t of ["users", "api_keys", "models", "usage_logs", "verification_codes", "leads", "conversations", "conversation_messages"]) {
  await sql`ALTER TABLE ${sql(t)} ENABLE ROW LEVEL SECURITY`;
}
console.log(`数据库初始化完成（人民币计价，汇率 ${USD_CNY}）：${models.filter((x) => x[9] === "live").length} 个可用模型 + ${models.filter((x) => x[9] === "coming").length} 个即将接入 · 留资表 · 记忆表 · RLS 已开启`);
await sql.end();

import { pgTable, text, doublePrecision, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  account: text("account").notNull().unique(),      // 邮箱或手机号
  accountType: text("account_type").notNull(),      // "email" | "phone"
  passwordHash: text("password_hash").notNull(),
  balanceUsd: doublePrecision("balance_usd").notNull().default(5.0), // 新用户送 $5 虚拟额度
  status: text("status").notNull().default("active"),                 // active | banned
  dailyLimitUsd: doublePrecision("daily_limit_usd"),                  // 每日消费上限，null=不限
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const verificationCodes = pgTable("verification_codes", {
  id: text("id").primaryKey(),
  target: text("target").notNull(),                 // 邮箱或手机号
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("default"),
  keyHash: text("key_hash").notNull().unique(), // 只存哈希，明文不可找回
  prefix: text("prefix").notNull(),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const models = pgTable("models", {
  id: text("id").primaryKey(),          // 对外模型名
  provider: text("provider").notNull(), // anthropic | deepseek
  upstreamId: text("upstream_id").notNull(),
  displayName: text("display_name").notNull(),
  inputPerM: doublePrecision("input_per_m").notNull(),   // 用户价 $/百万输入（上游价×加价率）
  outputPerM: doublePrecision("output_per_m").notNull(), // 用户价 $/百万输出
  upstreamInputPerM: doublePrecision("upstream_input_per_m").notNull(),   // 上游成本价
  upstreamOutputPerM: doublePrecision("upstream_output_per_m").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const usageLogs = pgTable("usage_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  apiKeyId: text("api_key_id").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: doublePrecision("cost_usd").notNull(),               // 向用户收取（进账）
  upstreamCostUsd: doublePrecision("upstream_cost_usd").notNull().default(0), // 上游成本
  latencyMs: integer("latency_ms").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

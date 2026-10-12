import { pgTable, text, doublePrecision, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  account: text("account").notNull().unique(),      // 邮箱或手机号
  accountType: text("account_type").notNull(),      // "email" | "phone"
  passwordHash: text("password_hash").notNull(),
  balance: doublePrecision("balance").notNull().default(30), // 账户余额（元），新用户赠送额度见 SIGNUP_BONUS_CNY
  status: text("status").notNull().default("active"),                 // active | banned
  dailyLimit: doublePrecision("daily_limit"),                         // 每日消费上限（元），null=不限
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
  provider: text("provider").notNull(), // anthropic | deepseek | qwen | kimi
  upstreamId: text("upstream_id").notNull(),
  displayName: text("display_name").notNull(),
  inputPerM: doublePrecision("input_per_m").notNull(),   // 用户售价：元 / 百万输入 tokens（上游美元价 × 汇率 × 1.3）
  outputPerM: doublePrecision("output_per_m").notNull(), // 用户售价：元 / 百万输出 tokens
  upstreamInputPerM: doublePrecision("upstream_input_per_m").notNull(),   // 上游成本价：美元 / 百万 tokens（各家国际站官方价）
  upstreamOutputPerM: doublePrecision("upstream_output_per_m").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  vendor: text("vendor").notNull().default(""),           // 厂商，如 Anthropic / 阿里通义
  category: text("category").notNull().default("对话"),    // 模型类型标签
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("live"),        // live 可调用 | coming 即将接入
  sortOrder: integer("sort_order").notNull().default(100),
});

// 企业客户留资（首页「咨询 AI 落地」）
export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  source: text("source").notNull().default("home"),       // 来自哪个按钮
  status: text("status").notNull().default("new"),        // new | contacted
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const usageLogs = pgTable("usage_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  apiKeyId: text("api_key_id").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cost: doublePrecision("cost").notNull(),                       // 向用户收取（元）
  upstreamCost: doublePrecision("upstream_cost").notNull().default(0),  // 上游成本（按汇率折成元）
  latencyMs: integer("latency_ms").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// 平台记忆：会话归属于注册账号（同账号的不同密钥共享），网关自动拼接摘要与近期消息
export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),                              // conv_ 开头
  userId: text("user_id").notNull(),
  title: text("title").notNull().default(""),               // 首条提问的前 40 字
  summary: text("summary").notNull().default(""),           // 早期对话压缩后的摘要
  model: text("model").notNull().default(""),              // 最近一次使用的模型
  lastPromptTokens: integer("last_prompt_tokens").notNull().default(0), // 上一轮真实输入 token，用于判断是否压缩
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),                             // user | assistant
  content: text("content").notNull(),
  summarized: boolean("summarized").notNull().default(false), // 已并入摘要，不再原文发送
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

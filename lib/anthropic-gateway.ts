import { NextRequest } from "next/server";
import { authenticateApiKey } from "./apikey";
import { ClaudeUsage } from "./claude-pricing";

// Claude Code 入口（Anthropic Messages 格式）的公共部分
// 原则：请求体与 anthropic-* 头原样转发，响应字节原样回传（含 ping），只在旁路读取用量计费

// 错误统一用 Anthropic 的格式，Claude Code 才能正确显示
export const aErr = (status: number, type: string, message: string) =>
  Response.json({ type: "error", error: { type, message } }, { status });

// 书童密钥可放在 Authorization: Bearer（ANTHROPIC_AUTH_TOKEN）或 x-api-key（ANTHROPIC_API_KEY）
export async function authAnthropic(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  const xkey = req.headers.get("x-api-key");
  return (bearer && (await authenticateApiKey(bearer))) || (xkey ? await authenticateApiKey(`Bearer ${xkey}`) : null);
}

// 上游：直连 Anthropic，或经境外中继（与 OpenAI 格式入口共用同一组环境变量）
export function upstreamUrl(path: string, search: string) {
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
  return `${base}${path}${search}`;
}

export function upstreamHeaders(req: NextRequest) {
  const h: Record<string, string> = { "content-type": "application/json" };
  req.headers.forEach((v, k) => {
    if (k.startsWith("anthropic-")) h[k] = v; // anthropic-version / anthropic-beta 等，按开放列表原样转发
  });
  h["anthropic-version"] ||= "2023-06-01";
  h["x-api-key"] = process.env.ANTHROPIC_API_KEY || "";
  if (process.env.ANTHROPIC_RELAY_TOKEN) h["x-relay-token"] = process.env.ANTHROPIC_RELAY_TOKEN;
  return h;
}

// 回传给客户端的响应头：重试、限流、请求 ID 等
export function passHeaders(res: Response) {
  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (k === "content-type" || k === "retry-after" || k === "x-should-retry" || k === "request-id" || k.startsWith("anthropic-ratelimit")) out.set(k, v);
  });
  if (!out.has("content-type")) out.set("content-type", "application/json");
  out.set("cache-control", "no-cache");
  return out;
}

export const emptyUsage = (): ClaudeUsage => ({
  input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cache_5m: null, cache_1h: null,
});

// 合并一段 usage（message_start 给输入与缓存，message_delta 给累计输出，新版也可能带最终输入）
export function mergeUsage(acc: ClaudeUsage, u: any) {
  if (!u || typeof u !== "object") return;
  const take = (k: keyof ClaudeUsage, v: unknown) => { if (typeof v === "number") (acc as any)[k] = Math.max((acc as any)[k] ?? 0, v); };
  take("input_tokens", u.input_tokens);
  take("output_tokens", u.output_tokens);
  take("cache_creation_input_tokens", u.cache_creation_input_tokens);
  take("cache_read_input_tokens", u.cache_read_input_tokens);
  if (u.cache_creation && typeof u.cache_creation === "object") {
    take("cache_5m", u.cache_creation.ephemeral_5m_input_tokens);
    take("cache_1h", u.cache_creation.ephemeral_1h_input_tokens);
  }
}

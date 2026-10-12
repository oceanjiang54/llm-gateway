// 模型厂商的字母头像配色（用首字母色块代替各家商标图形）
const AV: Record<string, { bg: string; fg: string; ch: string }> = {
  anthropic: { bg: "#f6ece4", fg: "#a2582b", ch: "C" },
  deepseek: { bg: "#e9effc", fg: "#2c5cc5", ch: "D" },
  qwen: { bg: "#efebfc", fg: "#5d43c9", ch: "Q" },
  kimi: { bg: "#e5f5ee", fg: "#0f7d5a", ch: "K" },
  minimax: { bg: "#fdecef", fg: "#b8364e", ch: "M" },
  openai: { bg: "#eceef1", fg: "#2b2f36", ch: "G" },
  google: { bg: "#e6f1fc", fg: "#1f6fbf", ch: "G" },
};
export function avatarOf(provider: string, name = "") {
  return AV[provider] ?? { bg: "#eceef1", fg: "#545c73", ch: (name[0] || "?").toUpperCase() };
}

// 首屏生态条展示的模型家族（顺序即展示顺序）
export const ECOSYSTEM = [
  { name: "DeepSeek", provider: "deepseek" },
  { name: "Qwen", provider: "qwen" },
  { name: "Kimi", provider: "kimi" },
  { name: "Claude", provider: "anthropic" },
  { name: "MiniMax", provider: "minimax" },
  { name: "GPT", provider: "openai" },
  { name: "Gemini", provider: "google" },
];

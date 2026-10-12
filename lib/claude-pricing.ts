// Claude Code 入口的计价：按 Anthropic 官方价（2026-10 核对 platform.claude.com/docs/en/about-claude/pricing）
// 单位：美元 / 百万 tokens。in=普通输入 w5=5分钟缓存写入 w1h=1小时缓存写入 r=缓存命中 out=输出
interface Price { in: number; w5: number; w1h: number; r: number; out: number }
const P = (i: number, w5: number, w1h: number, r: number, out: number): Price => ({ in: i, w5, w1h, r, out });

const TABLE: Record<string, Price> = {
  "fable-5-1": P(10, 12.5, 20, 0.25, 50),
  "mythos-5-1": P(10, 12.5, 20, 0.25, 50),
  "fable-5": P(10, 12.5, 20, 1, 50),
  "mythos-5": P(10, 12.5, 20, 1, 50),
  "opus-5-5": P(4, 5, 8, 0.2, 20),
  "opus-5": P(5, 6.25, 10, 0.5, 25),
  "opus-4-8": P(5, 6.25, 10, 0.5, 25),
  "opus-4-7": P(5, 6.25, 10, 0.5, 25),
  "opus-4-6": P(5, 6.25, 10, 0.5, 25),
  "opus-4-5": P(5, 6.25, 10, 0.5, 25),
  "opus-4-1": P(15, 18.75, 30, 1.5, 75),
  "opus-4": P(15, 18.75, 30, 1.5, 75),
  "sonnet-5-5": P(2, 2.5, 4, 0.1, 10),
  "sonnet-5": P(2, 2.5, 4, 0.2, 10),
  "sonnet-4-6": P(3, 3.75, 6, 0.3, 15),
  "sonnet-4-5": P(3, 3.75, 6, 0.3, 15),
  "sonnet-4": P(3, 3.75, 6, 0.3, 15),
  "haiku-5-5": P(0.1, 0.125, 0.2, 0.01, 0.5),
  "haiku-4-5": P(1, 1.25, 2, 0.1, 5),
};
// Haiku 5.5 单次提示超过 10 万 tokens 时的高档价
const HAIKU_55_LONG = P(0.5, 0.625, 1, 0.05, 2.5);

export const CLAUDE_MARKUP = 1.3;

// 规整模型 ID：claude-opus-4-8-20260101 / claude-sonnet-4-6[1m] → opus-4-8 / sonnet-4-6
function normalize(id: string) {
  return id.toLowerCase().replace(/\[.*?\]$/, "").replace(/^claude-/, "").replace(/\./g, "-");
}

// 找到对应价格；精确匹配 key 或 key + 日期后缀，未知型号返回 null（拒绝而不是猜价）
export function claudePrice(modelId: string): { key: string; price: Price } | null {
  const n = normalize(modelId);
  for (const key of Object.keys(TABLE).sort((a, b) => b.length - a.length)) {
    if (n === key || new RegExp(`^${key}-\\d{8}$`).test(n)) return { key, price: TABLE[key] };
  }
  return null;
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_5m: number | null; // cache_creation 分项（有则按分项计）
  cache_1h: number | null;
}

// 计算上游成本与向用户收取的费用
export function claudeCost(key: string, price: Price, u: ClaudeUsage) {
  const promptTotal = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
  const p = key === "haiku-5-5" && promptTotal > 100_000 ? HAIKU_55_LONG : price;
  const write = u.cache_5m != null || u.cache_1h != null
    ? (u.cache_5m ?? 0) * p.w5 + (u.cache_1h ?? 0) * p.w1h
    : u.cache_creation_input_tokens * p.w5;
  const upstream = (u.input_tokens * p.in + write + u.cache_read_input_tokens * p.r + u.output_tokens * p.out) / 1e6;
  return { upstream, charge: upstream * CLAUDE_MARKUP, promptTotal };
}

// Claude Code 模型选择器展示的列表（/v1/models）
export const CLAUDE_CODE_MODELS = [
  { id: "claude-opus-5-5", display_name: "Claude Opus 5.5" },
  { id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5" },
  { id: "claude-haiku-5-5", display_name: "Claude Haiku 5.5" },
  { id: "claude-fable-5-1", display_name: "Claude Fable 5.1" },
  { id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-8", display_name: "Claude Opus 4.8" },
  { id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5" },
];

// 计费说明页用：Claude Code 模型的对外人民币价格（元 / 百万 tokens）
export function claudeCnyPriceList(rate: number) {
  const r = (x: number) => Math.round(x * CLAUDE_MARKUP * rate * 100) / 100;
  return CLAUDE_CODE_MODELS.map((m) => {
    const p = claudePrice(m.id)!.price;
    return { id: m.id, name: m.display_name, in: r(p.in), w5: r(p.w5), w1h: r(p.w1h), read: r(p.r), out: r(p.out) };
  });
}

// Codex 入口（OpenAI Responses 格式）的计价：OpenAI 官方 Standard 价（2026-10 核对 developers.openai.com/api/docs/pricing）
// 单位：美元 / 百万 tokens。in=未命中缓存的输入 cached=缓存命中 out=输出（含推理 token）
interface Price { in: number; cached: number; out: number }

const TABLE: Record<string, Price> = {
  "gpt-6-astra": { in: 10, cached: 1, out: 50 },
  "gpt-6.1-sol": { in: 2, cached: 0.1, out: 10 },
  "gpt-6-luna": { in: 0.1, cached: 0.01, out: 0.5 },
  "gpt-5.3-codex": { in: 1.75, cached: 0.175, out: 14 },
};
export const OPENAI_MARKUP = 1.3;

// 精确匹配，或带日期后缀的快照（gpt-6.1-sol-2026-09-01）；未知型号返回 null（拒绝而不是猜价）
export function openaiPrice(modelId: string): { key: string; price: Price } | null {
  const id = modelId.toLowerCase();
  for (const key of Object.keys(TABLE).sort((a, b) => b.length - a.length)) {
    if (id === key || new RegExp(`^${key.replace(/\./g, "\\.")}-\\d{4}-\\d{2}-\\d{2}$`).test(id)) return { key, price: TABLE[key] };
  }
  return null;
}

// Responses API 的 usage：input_tokens 已包含 cached_tokens；output_tokens 已包含 reasoning_tokens
export interface ResponsesUsage { input_tokens: number; cached_tokens: number; output_tokens: number }

export function openaiCost(price: Price, u: ResponsesUsage) {
  const fresh = Math.max(0, u.input_tokens - u.cached_tokens);
  const upstream = (fresh * price.in + u.cached_tokens * price.cached + u.output_tokens * price.out) / 1e6;
  return { upstream, charge: upstream * OPENAI_MARKUP };
}

export const CODEX_MODELS = [
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
  { id: "gpt-6-astra", name: "GPT-6 Astra" },
  { id: "gpt-6-luna", name: "GPT-6 Luna" },
];

// 计费说明页：对外人民币价（元 / 百万 tokens）
export function openaiCnyPriceList(rate: number) {
  const r = (x: number) => Math.round(x * OPENAI_MARKUP * rate * 100) / 100;
  return CODEX_MODELS.map((m) => {
    const p = TABLE[m.id];
    return { id: m.id, name: m.name, in: r(p.in), cached: r(p.cached), out: r(p.out) };
  });
}

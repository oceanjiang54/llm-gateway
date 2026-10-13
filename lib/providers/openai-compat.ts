import { ChatRequest, ChatResult, Provider, Usage } from "./types";

// 通用 OpenAI 兼容适配器：DeepSeek / Qwen / Kimi 等国产模型共用
// 新增一家兼容 OpenAI 格式的上游 = 在 index.ts 里多写一行 makeOpenAICompat(...)
interface CompatOptions {
  name: string;          // 显示在错误信息里的上游名
  baseUrlEnv: string;    // 覆盖上游地址的环境变量名（测试/中继用）
  defaultBaseUrl: string;
  keyEnv: string;        // 上游密钥的环境变量名
  extraBody?: Record<string, unknown>; // 各家特有参数，如 Kimi 关闭思考模式
  maxTokensField?: "max_tokens" | "max_completion_tokens"; // OpenAI 推理模型只认 max_completion_tokens
  omitTemperature?: boolean;  // 推理模型不接受 temperature
  modelEnv?: string;          // 覆盖上游模型 ID 的环境变量（如豆包按版本号更新）
}

// 上游返回的用量：大多数在顶层 usage，个别实现放在 choices[0].usage
// 输出按「总量 − 输入」与 completion_tokens 取大：个别上游（如 Gemini 思考 token）只计入 total
function pickUsage(obj: any): Usage | null {
  const u = obj?.usage ?? obj?.choices?.[0]?.usage;
  if (!u || typeof u.prompt_tokens !== "number") return null;
  const completion = Math.max(u.completion_tokens ?? 0, (u.total_tokens ?? 0) - u.prompt_tokens);
  return { prompt_tokens: u.prompt_tokens, completion_tokens: completion, total_tokens: u.prompt_tokens + completion };
}

// 上游流式未返回用量时的兜底估算（按字符数折算，偏保守），保证每次调用都能计费
function estimateUsage(req: ChatRequest, output: string): Usage {
  const inChars = req.messages.reduce((n, m) => n + String(m.content ?? "").length, 0);
  const prompt = Math.ceil(inChars / 2) + 8;
  const completion = Math.ceil(output.length / 2);
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

export function makeOpenAICompat(opts: CompatOptions): Provider {
  const base = () => process.env[opts.baseUrlEnv] || opts.defaultBaseUrl;
  const key = () => process.env[opts.keyEnv] || "";

  async function call(upstreamModel: string, req: ChatRequest, stream: boolean) {
    const res = await fetch(`${base().replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: (opts.modelEnv && process.env[opts.modelEnv]) || upstreamModel,
        messages: req.messages,
        [opts.maxTokensField || "max_tokens"]: req.max_tokens,
        ...(opts.omitTemperature ? {} : { temperature: req.temperature }),
        stream,
        ...(stream ? { stream_options: { include_usage: true } } : {}),
        ...(opts.extraBody || {}),
      }),
    });
    if (!res.ok) throw new Error(`${opts.name} upstream ${res.status}: ${await res.text()}`);
    return res;
  }

  return {
    name: opts.name,
    configured: () => !!key(),

    async chat(upstreamModel, req): Promise<ChatResult> {
      const res = await call(upstreamModel, req, false);
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content ?? "",
        usage: pickUsage(data) ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    },

    async chatStream(upstreamModel, req, onUsage) {
      const res = await call(upstreamModel, req, true);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      let settled = false;
      let output = "";

      // 主动读取循环：逐行转发，用量块统一规整到顶层 usage，便于客户端与计费读取
      return new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                if (!line.startsWith("data: ") || line === "data: [DONE]") {
                  controller.enqueue(encoder.encode(line + "\n"));
                  continue;
                }
                let out = line;
                try {
                  const chunk = JSON.parse(line.slice(6));
                  const d = chunk.choices?.[0]?.delta?.content;
                  if (typeof d === "string") output += d;
                  const usage = pickUsage(chunk);
                  if (usage) {
                    if (!settled) { settled = true; await onUsage(usage); }
                    if (!chunk.usage) { chunk.usage = usage; out = "data: " + JSON.stringify(chunk); }
                  }
                } catch {}
                controller.enqueue(encoder.encode(out + "\n"));
              }
            }
            if (buffer) controller.enqueue(encoder.encode(buffer));
            if (!settled) {
              settled = true;
              console.warn(`[gateway] ${opts.name} stream ended without usage; billing by estimate`);
              await onUsage(estimateUsage(req, output));
            }
          } finally {
            controller.close();
          }
        },
        cancel() { reader.cancel(); },
      });
    },
  };
}

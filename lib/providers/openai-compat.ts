import { ChatRequest, ChatResult, Provider, Usage } from "./types";

// 通用 OpenAI 兼容适配器：DeepSeek / Qwen / Kimi 等国产模型共用
// 新增一家兼容 OpenAI 格式的上游 = 在 index.ts 里多写一行 makeOpenAICompat(...)
interface CompatOptions {
  name: string;          // 显示在错误信息里的上游名
  baseUrlEnv: string;    // 覆盖上游地址的环境变量名（测试/中继用）
  defaultBaseUrl: string;
  keyEnv: string;        // 上游密钥的环境变量名
  extraBody?: Record<string, unknown>; // 各家特有参数，如 Kimi 关闭思考模式
}

// 上游返回的用量：大多数在顶层 usage，个别实现放在 choices[0].usage
function pickUsage(obj: any): Usage | null {
  const u = obj?.usage ?? obj?.choices?.[0]?.usage;
  if (!u || typeof u.prompt_tokens !== "number") return null;
  return {
    prompt_tokens: u.prompt_tokens,
    completion_tokens: u.completion_tokens ?? 0,
    total_tokens: u.total_tokens ?? u.prompt_tokens + (u.completion_tokens ?? 0),
  };
}

export function makeOpenAICompat(opts: CompatOptions): Provider {
  const base = () => process.env[opts.baseUrlEnv] || opts.defaultBaseUrl;
  const key = () => process.env[opts.keyEnv] || "";

  async function call(upstreamModel: string, req: ChatRequest, stream: boolean) {
    const res = await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: upstreamModel,
        messages: req.messages,
        max_tokens: req.max_tokens,
        temperature: req.temperature,
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
          } finally {
            controller.close();
          }
        },
        cancel() { reader.cancel(); },
      });
    },
  };
}

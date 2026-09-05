import { ChatRequest, ChatResult, Provider, Usage } from "./types";

// DeepSeek 完全兼容 OpenAI 格式：请求直接透传，是接入成本最低的上游
const BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

async function call(upstreamModel: string, req: ChatRequest, stream: boolean) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: upstreamModel,
      messages: req.messages,
      max_tokens: req.max_tokens,
      temperature: req.temperature,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek upstream ${res.status}: ${await res.text()}`);
  return res;
}

export const deepseek: Provider = {
  name: "deepseek",

  async chat(upstreamModel, req): Promise<ChatResult> {
    const res = await call(upstreamModel, req, false);
    const data = await res.json();
    return { content: data.choices[0].message.content, usage: data.usage as Usage };
  },

  async chatStream(upstreamModel, req, onUsage) {
    const res = await call(upstreamModel, req, true);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // 透传 SSE，同时从末尾 usage 块提取用量用于计费
    return new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.usage) await onUsage(chunk.usage as Usage);
            } catch {}
          }
        }
        controller.enqueue(value);
      },
      cancel() { reader.cancel(); },
    });
  },
};

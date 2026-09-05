import { ChatMessage, ChatRequest, ChatResult, Provider, Usage } from "./types";

// Anthropic Messages API：格式与 OpenAI 不同，适配器负责双向转换
const BASE = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";

function convertMessages(messages: ChatMessage[]) {
  // Anthropic 要求 system 单独传，且消息必须 user/assistant 交替
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system: system || undefined, messages: rest };
}

async function call(upstreamModel: string, req: ChatRequest, stream: boolean) {
  const { system, messages } = convertMessages(req.messages);
  const res = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: upstreamModel,
      system,
      messages,
      max_tokens: req.max_tokens ?? 1024,
      temperature: req.temperature,
      stream,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic upstream ${res.status}: ${await res.text()}`);
  return res;
}

// 把 Anthropic 响应转换为 OpenAI Chat Completions 格式（对外统一）
export const anthropic: Provider = {
  name: "anthropic",

  async chat(upstreamModel, req): Promise<ChatResult> {
    const res = await call(upstreamModel, req, false);
    const data = await res.json();
    return {
      content: data.content?.[0]?.text ?? "",
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  },

  async chatStream(upstreamModel, req, onUsage) {
    const res = await call(upstreamModel, req, true);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const chatId = "chatcmpl-" + Math.random().toString(36).slice(2);

    const openaiChunk = (delta: object, finish: string | null = null) =>
      encoder.encode(
        `data: ${JSON.stringify({
          id: chatId,
          object: "chat.completion.chunk",
          model: req.model,
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`
      );

    return new ReadableStream({
      async start(controller) {
        controller.enqueue(openaiChunk({ role: "assistant", content: "" }));
        try {
          // 主动读取循环：不依赖 pull 重调度，事件稀疏时也不会停摆
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const ev = JSON.parse(line.slice(6));
                if (ev.type === "message_start") {
                  inputTokens = ev.message?.usage?.input_tokens ?? 0;
                } else if (ev.type === "content_block_delta" && ev.delta?.text) {
                  controller.enqueue(openaiChunk({ content: ev.delta.text }));
                } else if (ev.type === "message_delta" && ev.usage?.output_tokens) {
                  outputTokens = ev.usage.output_tokens;
                }
              } catch {}
            }
          }
        } finally {
          const usage: Usage = {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          };
          await onUsage(usage).catch(() => {});
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ id: chatId, object: "chat.completion.chunk", model: req.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
      cancel() { reader.cancel(); },
    });
  },
};

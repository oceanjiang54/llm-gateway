// 统一对外采用 OpenAI Chat Completions 格式（业界事实标准，OpenRouter 同款设计）
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;            // 对外模型名
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResult {
  content: string;
  usage: Usage;
}

// 每个上游模型服务实现这个接口 —— 之后接入通义/智谱/文心只需新增一个适配器
export interface Provider {
  name: string;
  chat(upstreamModel: string, req: ChatRequest): Promise<ChatResult>;
  // 返回 OpenAI 风格 SSE 流；onUsage 在流结束时回传用量以便计费
  chatStream(
    upstreamModel: string,
    req: ChatRequest,
    onUsage: (u: Usage) => Promise<void>
  ): Promise<ReadableStream<Uint8Array>>;
}

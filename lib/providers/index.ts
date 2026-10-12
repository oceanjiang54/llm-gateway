import { Provider } from "./types";
import { anthropic } from "./anthropic";
import { makeOpenAICompat } from "./openai-compat";

// Provider 注册表 —— 新增 OpenAI 兼容的上游只需在此加一行
export const providers: Record<string, Provider> = {
  anthropic,
  deepseek: makeOpenAICompat({
    name: "DeepSeek",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    keyEnv: "DEEPSEEK_API_KEY",
  }),
  // 阿里云百炼国际站（新加坡）；国内站改 QWEN_BASE_URL 为 https://dashscope.aliyuncs.com/compatible-mode/v1
  qwen: makeOpenAICompat({
    name: "Qwen",
    baseUrlEnv: "QWEN_BASE_URL",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    keyEnv: "QWEN_API_KEY",
  }),
  // Moonshot 国际站；国内站改 KIMI_BASE_URL 为 https://api.moonshot.cn/v1
  // K2.6 默认开启思考模式（首字很慢），对话场景默认关闭
  kimi: makeOpenAICompat({
    name: "Kimi",
    baseUrlEnv: "KIMI_BASE_URL",
    defaultBaseUrl: "https://api.moonshot.ai/v1",
    keyEnv: "KIMI_API_KEY",
    extraBody: { thinking: { type: "disabled" } },
  }),
};

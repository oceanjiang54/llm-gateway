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
  // OpenAI 官方。GPT-6 系列为推理模型：用 max_completion_tokens，不传 temperature
  openai: makeOpenAICompat({
    name: "OpenAI",
    baseUrlEnv: "OPENAI_BASE_URL",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    maxTokensField: "max_completion_tokens",
    omitTemperature: true,
  }),
  // Google Gemini 的 OpenAI 兼容层
  google: makeOpenAICompat({
    name: "Gemini",
    baseUrlEnv: "GEMINI_BASE_URL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
  }),
  // 字节跳动火山方舟（豆包）；模型 ID 带版本日期，可用 DOUBAO_MODEL 覆盖为控制台里实际开通的版本
  doubao: makeOpenAICompat({
    name: "Doubao",
    baseUrlEnv: "DOUBAO_BASE_URL",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    keyEnv: "DOUBAO_API_KEY",
    modelEnv: "DOUBAO_MODEL",
  }),
};

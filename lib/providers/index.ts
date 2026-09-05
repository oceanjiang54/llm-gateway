import { Provider } from "./types";
import { anthropic } from "./anthropic";
import { deepseek } from "./deepseek";

// Provider 注册表 —— 新增上游只需在此登记
export const providers: Record<string, Provider> = {
  anthropic,
  deepseek,
};

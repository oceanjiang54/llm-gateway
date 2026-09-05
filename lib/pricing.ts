// 按模型定价计算单次调用成本（美元）
export function calcCost(inputTokens: number, outputTokens: number, inputPerM: number, outputPerM: number) {
  return (inputTokens / 1e6) * inputPerM + (outputTokens / 1e6) * outputPerM;
}

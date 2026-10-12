// 人民币结算：上游各家按美元计价，书童对用户统一按人民币计价与结算
// 汇率默认 7.0（2026-10 市场价约 6.69，留约 4.6% 覆盖汇率波动与换汇成本），可用环境变量 USD_CNY_RATE 调整
// 调整汇率后需重新执行 npm run db:setup，模型售价才会按新汇率重算
export const USD_CNY = Number(process.env.USD_CNY_RATE || 7.0);

// 新用户注册赠送额度（元）
export const SIGNUP_BONUS_CNY = Number(process.env.SIGNUP_BONUS_CNY || 30);

// 金额显示：≥1 元两位小数，≥1 分四位，更小六位（单次调用常常只有几厘钱）
export function yuan(v: number | string | null | undefined) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  return "¥" + n.toFixed(a >= 1 ? 2 : a >= 0.01 ? 4 : 6);
}

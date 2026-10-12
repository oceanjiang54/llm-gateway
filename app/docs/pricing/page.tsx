import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import DocNext from "@/components/docs/DocNext";
import { db, schema } from "@/lib/db";
import { SIGNUP_BONUS_CNY, USD_CNY } from "@/lib/currency";
import { claudeCnyPriceList } from "@/lib/claude-pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "计费说明 · 书童文档" };

const f = (x: number) => `¥${x.toFixed(2)}`;

export default async function PricingDoc() {
  const models = await db.select().from(schema.models)
    .where(and(eq(schema.models.enabled, true), eq(schema.models.status, "live")))
    .orderBy(asc(schema.models.sortOrder));
  const claude = claudeCnyPriceList(USD_CNY);
  return (
    <>
      <h1>计费说明</h1>
      <p className="lead">书童按实际 tokens 用量以人民币计费，调用成功后从账户余额实时扣除，没有月费和最低消费。</p>

      <h2>计费方式</h2>
      <ul>
        <li><b>费用 = 输入 tokens × 输入单价 + 输出 tokens × 输出单价</b>，单价以「元 / 百万 tokens」标注。</li>
        <li>新注册账号赠送 ¥{SIGNUP_BONUS_CNY} 试用额度。</li>
        <li>调用失败（如 4xx、5xx）不扣费；开启平台记忆后，自动压缩产生的费用记为 <code>memory</code>。</li>
        <li>每次调用的 tokens 与费用可在 <Link href="/console">控制台</Link> 查看；余额为 0 时请求返回 402。</li>
        <li>管理员可为账户设置每日用量上限，达到上限后当天请求返回 429。</li>
      </ul>

      <h2>对话补全价格</h2>
      <p>适用于 <code>/api/v1/chat/completions</code>，单位：元 / 百万 tokens。</p>
      <table>
        <thead><tr><th>模型 ID</th><th>名称</th><th>输入</th><th>输出</th></tr></thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}><td><code>{m.id}</code></td><td>{m.displayName}</td><td>{f(m.inputPerM)}</td><td>{f(m.outputPerM)}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Claude Code 价格</h2>
      <p>适用于 <code>/api/anthropic</code> 入口，单位：元 / 百万 tokens。提示缓存按写入与命中分别计价。</p>
      <table>
        <thead><tr><th>模型 ID</th><th>输入</th><th>缓存写入 5 分钟</th><th>缓存写入 1 小时</th><th>缓存命中</th><th>输出</th></tr></thead>
        <tbody>
          {claude.map((m) => (
            <tr key={m.id}><td><code>{m.id}</code></td><td>{f(m.in)}</td><td>{f(m.w5)}</td><td>{f(m.w1h)}</td><td>{f(m.read)}</td><td>{f(m.out)}</td></tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13.5 }}>Claude Haiku 5.5 单次输入超过 10 万 tokens 时按长上下文价格计费（约为上表的 5 倍）。</p>
      <DocNext href="/docs/pricing" />
    </>
  );
}

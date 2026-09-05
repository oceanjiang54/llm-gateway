import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 控制台：余额 + 用量统计 + 最近调用明细
export default async function Console() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
  if (!user) redirect("/logout"); // 旧数据库时代的会话：清除并重新登录
  const logs = await db.select().from(schema.usageLogs)
    .where(eq(schema.usageLogs.userId, userId))
    .orderBy(desc(schema.usageLogs.createdAt))
    .limit(20);
  const agg = (await db.select({
    count: sql<number>`count(*)`,
    tokens: sql<number>`coalesce(sum(input_tokens + output_tokens), 0)`,
  }).from(schema.usageLogs).where(eq(schema.usageLogs.userId, userId)))[0];

  return (
    <div className="container">
      <h2 className="section-title">控制台</h2>
      <p className="section-sub">书童记账：每一笔调用、每一分成本，清清楚楚</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <a href="/console/keys" className="btn secondary" style={{ padding: "8px 18px", fontSize: 13 }}>管理密钥</a>
        <a href="/playground" className="btn" style={{ padding: "8px 18px", fontSize: 13 }}>去体验</a>
      </div>
      <div className="grid3">
        <div className="card">
          <div className="label">账户余额 · 试用额度</div>
          <div className="stat">${user.balanceUsd.toFixed(4)}</div>
        </div>
        <div className="card">
          <div className="label">累计调用次数</div>
          <div className="stat">{agg.count}</div>
        </div>
        <div className="card">
          <div className="label">累计消耗 Tokens</div>
          <div className="stat">{Number(agg.tokens).toLocaleString()}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 15 }}>最近调用</h3>
        <table>
          <thead>
            <tr><th>时间</th><th>模型</th><th>输入</th><th>输出</th><th>费用</th><th>耗时</th><th>状态</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.createdAt.toLocaleString("zh-CN")}</td>
                <td><code>{l.model}</code></td>
                <td>{l.inputTokens}</td>
                <td>{l.outputTokens}</td>
                <td>${l.costUsd.toFixed(6)}</td>
                <td>{l.latencyMs}ms</td>
                <td>{l.status}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>还没有调用记录——先去创建一个 API Key，让书童跑起来</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

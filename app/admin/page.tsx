"use client";
import { useEffect, useState } from "react";

interface Core { total_users: number; today_users: number; total_calls: number; today_calls: number; revenue_total: number; revenue_today: number; cost_total: number; cost_today: number; }
interface UserRow { id: string; account: string; status: string; balance_usd: number; daily_limit_usd: number | null; spent: number; calls: number; }

// 管理后台：核心指标（30秒轮询）+ 7日趋势 + 模型分布 + 用户管理
export default function Admin() {
  const [core, setCore] = useState<Core | null>(null);
  const [trend, setTrend] = useState<{ d: string; c: number }[]>([]);
  const [byModel, setByModel] = useState<{ model: string; calls: number; tokens: number; revenue: number }[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [denied, setDenied] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(""), 2600); }

  async function loadStats() {
    const res = await fetch("/api/admin/stats");
    if (res.status === 404 || res.status === 401) { setDenied(true); return; }
    const d = await res.json();
    setCore(d.core); setTrend(d.trend); setByModel(d.byModel);
  }
  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (!res.ok) return;
    setUsers((await res.json()).users);
  }
  useEffect(() => {
    loadStats(); loadUsers();
    const timer = setInterval(loadStats, 30000); // 实时：30秒刷新
    return () => clearInterval(timer);
  }, []);

  async function act(id: string, action: string, value?: string | number | null) {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, value }),
    });
    const d = await res.json();
    showToast(res.ok ? "操作成功" : d.error || "操作失败");
    loadUsers(); loadStats();
  }

  if (denied) return <div className="container"><div className="card">无权访问。请使用管理员账号登录后再访问本页。</div></div>;
  if (!core) return <div className="container"><div className="card">加载中…</div></div>;

  const n = (x: any) => Number(x) || 0;
  // 自适应精度：>=1美元2位，>=1美分4位，更小6位——原型小额也能看清
  const money = (x: any) => { const v = n(x); const ab = Math.abs(v); return "$" + v.toFixed(ab >= 1 ? 2 : ab >= 0.01 ? 4 : 6); };
  const margin = n(core.revenue_total) - n(core.cost_total);
  const marginPct = n(core.revenue_total) > 0 ? Math.round((margin / n(core.revenue_total)) * 100) : 0;
  const maxTrend = Math.max(...trend.map((t) => t.c), 1);
  const maxModel = Math.max(...byModel.map((m) => m.calls), 1);
  const pts = trend.map((t, i) => `${trend.length > 1 ? (i / (trend.length - 1)) * 300 : 150},${56 - (t.c / maxTrend) * 48}`).join(" ");

  const metrics = [
    { l: "总用户", v: n(core.total_users).toLocaleString(), s: `今日 +${n(core.today_users)}`, c: "var(--text)" },
    { l: "今日调用", v: n(core.today_calls).toLocaleString(), s: `累计 ${n(core.total_calls).toLocaleString()}`, c: "var(--text)" },
    { l: "进账（累计）", v: money(core.revenue_total), s: `今日 ${money(core.revenue_today)}`, c: "var(--teal)" },
    { l: "上游成本", v: money(core.cost_total), s: `今日 ${money(core.cost_today)}`, c: "#f0b86c" },
    { l: "毛利", v: money(margin), s: `利润率 ${marginPct}%`, c: "var(--text)" },
  ];

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="section-title">管理后台</h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}><span style={{ color: "var(--teal)" }}>●</span> 实时 · 30s 自动刷新</span>
      </div>
      <p className="section-sub">书童账房：经营全貌与用户管理</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        {metrics.map((m) => (
          <div className="card" key={m.l} style={{ marginBottom: 0, padding: "16px 18px" }}>
            <div className="label">{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{m.s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="label">近7天调用量趋势</div>
          <svg viewBox="0 0 300 60" style={{ width: "100%", height: 70 }}>
            {trend.length > 1 && <>
              <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" />
              <polyline points={`${pts} 300,60 0,60`} fill="var(--accent)" opacity="0.12" />
            </>}
            {trend.length <= 1 && <text x="150" y="34" fill="var(--muted)" fontSize="10" textAnchor="middle">数据积累中</text>}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)" }}>
            {trend.map((t) => <span key={t.d}>{t.d}</span>)}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="label">模型流量分布</div>
          {byModel.map((m) => (
            <div key={m.model} style={{ fontSize: 11, color: "var(--sub)", margin: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{m.model}</span><span style={{ fontFamily: "var(--mono)" }}>{m.calls} 次 · {money(m.revenue)}</span>
              </div>
              <div style={{ height: 7, background: "var(--bg2)", borderRadius: 4, marginTop: 4 }}>
                <div style={{ height: 7, width: `${(m.calls / maxModel) * 100}%`, background: "var(--blue)", borderRadius: 4 }} />
              </div>
            </div>
          ))}
          {byModel.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>暂无调用</p>}
        </div>
      </div>

      <div className="card">
        <div className="label">用户管理（{users.length}）</div>
        <table>
          <thead><tr><th>账号</th><th>余额</th><th>累计消费</th><th>调用数</th><th>每日限额</th><th>状态</th><th style={{ textAlign: "right" }}>操作</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.account}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{money(u.balance_usd)}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{money(u.spent)}</td>
                <td>{u.calls}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{u.daily_limit_usd != null ? `$${n(u.daily_limit_usd).toFixed(2)}/天` : "不限"}</td>
                <td>{u.status === "banned" ? <span style={{ color: "var(--red)" }}>已封禁</span> : <span style={{ color: "var(--teal)" }}>正常</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: 12 }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); const v = window.prompt(`为 ${u.account} 设置新余额（美元）`, String(n(u.balance_usd).toFixed(2))); if (v !== null) act(u.id, "setBalance", v); }} style={{ color: "var(--blue)" }}>调整额度</a>
                  {" · "}
                  <a href="#" onClick={(e) => { e.preventDefault(); const v = window.prompt(`为 ${u.account} 设置每日消费上限（美元），填 0 取消限制`, u.daily_limit_usd != null ? String(u.daily_limit_usd) : "1"); if (v !== null) act(u.id, "setDailyLimit", v); }} style={{ color: "var(--purple)" }}>限制用量</a>
                  {" · "}
                  {u.status === "banned"
                    ? <a href="#" onClick={(e) => { e.preventDefault(); act(u.id, "unban"); }} style={{ color: "var(--teal)" }}>解封</a>
                    : <a href="#" onClick={(e) => { e.preventDefault(); if (window.confirm(`确认封禁 ${u.account}？其所有密钥将立即失效`)) act(u.id, "ban"); }} style={{ color: "var(--red)" }}>封禁</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

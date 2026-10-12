"use client";
import { useEffect, useState } from "react";

interface Core { total_users: number; new_users: number; calls: number; errors: number; active_users: number; revenue: number; cost: number; leads: number; }
interface LeadRow { id: string; company: string; name: string; phone: string; source: string; status: string; createdAt: string; }
interface UserRow { id: string; account: string; status: string; balance: number; daily_limit: number | null; spent: number; calls: number; }
interface Range { from: string; to: string; tz?: string }

// 日期工具（YYYY-MM-DD 字符串，按 UTC 做加减避免本地时区干扰）
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const monthStart = (d: string) => d.slice(0, 8) + "01";

// 管理后台：按时间区间（默认当天）查看经营指标、趋势、模型分布、线索与用户消费
export default function Admin() {
  const [range, setRange] = useState<Range>({ from: "", to: "" }); // 空 = 服务端默认当天
  const [today, setToday] = useState("");
  const [core, setCore] = useState<Core | null>(null);
  const [trend, setTrend] = useState<{ d: string; c: number }[]>([]);
  const [byModel, setByModel] = useState<{ model: string; calls: number; tokens: number; revenue: number }[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [denied, setDenied] = useState(false);
  const [toast, setToast] = useState("");
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [pending, setPending] = useState(0);
  const [onlyPending, setOnlyPending] = useState(false);
  const [draft, setDraft] = useState<Range>({ from: "", to: "" });

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(""), 2600); }
  const qs = (r: Range) => (r.from ? `?from=${r.from}&to=${r.to}` : "");

  async function loadStats(r = range) {
    const res = await fetch("/api/admin/stats" + qs(r));
    if (res.status === 404 || res.status === 401) { setDenied(true); return; }
    const d = await res.json();
    if (!res.ok) { showToast(d.error || "加载失败"); return; }
    setCore(d.core); setTrend(d.trend); setByModel(d.byModel);
    if (!r.from) { setToday(d.range.from); setRange({ from: d.range.from, to: d.range.to, tz: d.range.tz }); setDraft({ from: d.range.from, to: d.range.to }); }
  }
  async function loadLeads(r = range, p = onlyPending) {
    const res = await fetch("/api/leads" + (p ? "?pending=1" : qs(r)));
    if (res.ok) { const d = await res.json(); setLeads(d.leads); setPending(d.pending); }
  }
  async function markLead(id: string, status: "new" | "contacted") {
    await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    loadLeads();
  }
  async function loadUsers(r = range) {
    const res = await fetch("/api/admin/users" + qs(r));
    if (!res.ok) return;
    setUsers((await res.json()).users);
  }
  function apply(r: Range) {
    if (!r.from || !r.to) return;
    if (r.from > r.to) { showToast("开始日期不能晚于结束日期"); return; }
    setRange(r); setDraft(r);
    loadStats(r); loadUsers(r); loadLeads(r);
  }

  useEffect(() => { loadStats(); loadUsers(); loadLeads(); }, []);
  // 区间包含今天时 30 秒自动刷新
  const live = !!today && range.to >= today;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => loadStats(range), 30000);
    return () => clearInterval(timer);
  }, [live, range.from, range.to]);

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
  // 人民币，自适应精度：≥1元两位，≥1分四位，更小六位
  const money = (x: any) => { const v = n(x); const ab = Math.abs(v); return "¥" + v.toFixed(ab >= 1 ? 2 : ab >= 0.01 ? 4 : 6); };
  const margin = n(core.revenue) - n(core.cost);
  const marginPct = n(core.revenue) > 0 ? Math.round((margin / n(core.revenue)) * 100) : 0;
  const maxTrend = Math.max(...trend.map((t) => t.c), 1);
  const maxModel = Math.max(...byModel.map((m) => m.calls), 1);
  const pts = trend.map((t, i) => `${trend.length > 1 ? (i / (trend.length - 1)) * 300 : 150},${56 - (t.c / maxTrend) * 48}`).join(" ");
  const single = range.from === range.to;
  const label = single ? (range.from === today ? "今天" : range.from) : `${range.from} 至 ${range.to}`;
  // 横轴标签过多时抽样显示
  const step = Math.ceil(trend.length / 8);

  const presets: { k: string; r: Range }[] = today ? [
    { k: "今天", r: { from: today, to: today } },
    { k: "昨天", r: { from: addDays(today, -1), to: addDays(today, -1) } },
    { k: "近 7 天", r: { from: addDays(today, -6), to: today } },
    { k: "近 30 天", r: { from: addDays(today, -29), to: today } },
    { k: "本月", r: { from: monthStart(today), to: today } },
  ] : [];

  const metrics = [
    { l: "调用次数", v: n(core.calls).toLocaleString(), s: `失败 ${n(core.errors)} · 活跃用户 ${n(core.active_users)}`, c: "var(--text)" },
    { l: "进账", v: money(core.revenue), s: "用户消费合计", c: "var(--teal)" },
    { l: "上游成本", v: money(core.cost), s: "模型厂商成本", c: "var(--amber)" },
    { l: "毛利", v: money(margin), s: `利润率 ${marginPct}%`, c: "var(--text)" },
    { l: "新增用户", v: n(core.new_users).toLocaleString(), s: `总用户 ${n(core.total_users).toLocaleString()} · 新线索 ${n(core.leads)}`, c: "var(--text)" },
  ];

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 className="section-title">管理后台</h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {live ? <><span style={{ color: "var(--teal)" }}>●</span> 实时 · 30s 自动刷新</> : "历史区间"} · 按北京时间统计
        </span>
      </div>
      <p className="section-sub">书童账房：经营全貌与用户管理</p>

      <div className="range-bar card">
        <div className="range-presets">
          {presets.map((p) => (
            <button key={p.k} className={p.r.from === range.from && p.r.to === range.to ? "on" : ""} onClick={() => apply(p.r)}>{p.k}</button>
          ))}
        </div>
        <div className="range-custom">
          <input type="date" aria-label="开始日期" value={draft.from} max={draft.to || today} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <span>至</span>
          <input type="date" aria-label="结束日期" value={draft.to} min={draft.from} max={today} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <button className="btn secondary" onClick={() => apply({ from: draft.from, to: draft.to })} disabled={draft.from === range.from && draft.to === range.to}>查询</button>
        </div>
      </div>
      <div className="label" style={{ margin: "4px 2px 10px" }}>统计区间：{label}</div>

      <div className="grid5">
        {metrics.map((m) => (
          <div className="card" key={m.l} style={{ marginBottom: 0, padding: "16px 18px" }}>
            <div className="label">{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{m.s}</div>
          </div>
        ))}
      </div>

      <div className="grid-charts">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="label">调用量趋势（{single ? "按小时" : "按天"}）</div>
          <svg viewBox="0 0 300 60" style={{ width: "100%", height: 70 }}>
            {trend.length > 1 && <>
              <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" />
              <polyline points={`${pts} 300,60 0,60`} fill="var(--accent)" opacity="0.12" />
            </>}
            {trend.length <= 1 && <text x="150" y="34" fill="var(--muted)" fontSize="10" textAnchor="middle">数据积累中</text>}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)" }}>
            {trend.map((t, i) => (i % step === 0 || i === trend.length - 1) ? <span key={t.d}>{t.d}</span> : null)}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="label">模型流量分布（{label}）</div>
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
          {byModel.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>该区间暂无调用</p>}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <div className="label" style={{ margin: 0 }}>企业线索（{onlyPending ? `全部待联系 ${leads.length} 条` : `${label} ${leads.length} 条`}）</div>
          <label style={{ fontSize: 12, color: "var(--sub)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={onlyPending} onChange={(e) => { setOnlyPending(e.target.checked); loadLeads(range, e.target.checked); }} />
            只看全部待联系（{pending}）
          </label>
        </div>
        <table>
          <thead><tr><th>提交时间</th><th>企业名称</th><th>姓名</th><th>电话</th><th>来源</th><th>状态</th><th style={{ textAlign: "right" }}>操作</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString("zh-CN")}</td>
                <td>{l.company}</td>
                <td>{l.name}</td>
                <td style={{ fontFamily: "var(--mono)" }}><a href={`tel:${l.phone}`}>{l.phone}</a></td>
                <td style={{ color: "var(--muted)" }}>{l.source}</td>
                <td>{l.status === "contacted" ? <span style={{ color: "var(--muted)" }}>已联系</span> : <span style={{ color: "var(--amber)" }}>待联系</span>}</td>
                <td style={{ textAlign: "right", fontSize: 12 }}>
                  {l.status === "contacted"
                    ? <a href="#" onClick={(e) => { e.preventDefault(); markLead(l.id, "new"); }} style={{ color: "var(--muted)" }}>改回待联系</a>
                    : <a href="#" onClick={(e) => { e.preventDefault(); markLead(l.id, "contacted"); }} style={{ color: "var(--teal)" }}>标记已联系</a>}
                </td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>{onlyPending ? "没有待联系的线索" : "该区间没有新线索。首页「咨询 AI 落地」提交后会出现在这里"}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="label">用户管理（{users.length}）· 消费与调用数按所选区间统计</div>
        <table>
          <thead><tr><th>账号</th><th>余额</th><th>区间消费</th><th>区间调用</th><th>每日限额</th><th>状态</th><th style={{ textAlign: "right" }}>操作</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.account}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{money(u.balance)}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{money(u.spent)}</td>
                <td>{u.calls}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{u.daily_limit != null ? `¥${n(u.daily_limit).toFixed(2)}/天` : "不限"}</td>
                <td>{u.status === "banned" ? <span style={{ color: "var(--red)" }}>已封禁</span> : <span style={{ color: "var(--teal)" }}>正常</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: 12 }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); const v = window.prompt(`为 ${u.account} 设置新余额（元）`, String(n(u.balance).toFixed(2))); if (v !== null) act(u.id, "setBalance", v); }} style={{ color: "var(--blue)" }}>调整额度</a>
                  {" · "}
                  <a href="#" onClick={(e) => { e.preventDefault(); const v = window.prompt(`为 ${u.account} 设置每日消费上限（元），填 0 取消限制`, u.daily_limit != null ? String(u.daily_limit) : "10"); if (v !== null) act(u.id, "setDailyLimit", v); }} style={{ color: "var(--purple)" }}>限制用量</a>
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

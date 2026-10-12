"use client";
import { useEffect, useState } from "react";

// 「咨询 AI 落地」按钮 + 留资弹窗（企业名称、姓名、电话）
export default function LeadButton({
  children, className = "btn", source = "home",
}: { children: React.ReactNode; className?: string; source?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company: "", name: "", phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() { setOpen(false); if (done) { setDone(false); setForm({ company: "", name: "", phone: "" }); } }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (form.company.trim().length < 2) return setErr("请填写企业名称");
    if (!form.name.trim()) return setErr("请填写姓名");
    if (!form.phone.trim()) return setErr("请填写电话");
    setBusy(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, source }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setErr("网络异常，请稍后再试");
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error || "提交失败，请稍后再试");
    setDone(true);
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => { setForm({ ...form, [k]: e.target.value }); setErr(""); };

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{children}</button>
      {open && (
        <div className="modal-bg" onClick={close}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lead-title" onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={close} aria-label="关闭">×</button>
            {done ? (
              <div className="ok">
                <div className="big">✓</div>
                <h3 id="lead-title">已收到，我们会尽快联系你</h3>
                <p className="msub" style={{ marginBottom: 20 }}>FDE 团队将在 1 个工作日内通过电话与你沟通需求。</p>
                <button className="btn" onClick={close}>好的</button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h3 id="lead-title">预约 AI 落地咨询</h3>
                <p className="msub">留下联系方式，FDE 团队 1 个工作日内联系你。</p>
                <label htmlFor="lead-company">企业名称</label>
                <input id="lead-company" value={form.company} onChange={set("company")} placeholder="某某科技有限公司" autoComplete="organization" autoFocus />
                <label htmlFor="lead-name">姓名</label>
                <input id="lead-name" value={form.name} onChange={set("name")} placeholder="张经理" autoComplete="name" />
                <label htmlFor="lead-phone">电话</label>
                <input id="lead-phone" value={form.phone} onChange={set("phone")} placeholder="13800000000" inputMode="tel" autoComplete="tel" />
                <div className="err" role="alert">{err}</div>
                <button className="btn" type="submit" disabled={busy}>{busy ? "提交中…" : "提交"}</button>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>信息仅用于本次咨询联系，不会对外提供。</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

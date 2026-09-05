"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Register() {
  const [account, setAccount] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [qs, setQs] = useState("");
  useEffect(() => { setQs(window.location.search); }, []);
  const [hint, setHint] = useState("");
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  async function sendCode() {
    setErr(""); setHint("");
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: account }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || "发送失败"); return; }
    // 开发模式下验证码直接展示（未配置邮件/短信渠道时）
    setHint(data.devCode ? `开发模式验证码：${data.devCode}` : "验证码已发送，5分钟内有效");
    setCountdown(60);
    const timer = setInterval(() => setCountdown((c) => (c <= 1 ? (clearInterval(timer), 0) : c - 1)), 1000);
  }

  async function submit() {
    setErr("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password, code }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next") || "/console/keys";
      router.push(next); router.refresh();
    }
    else setErr((await res.json()).error || "注册失败");
  }

  return (
    <div className="form">
      <h2>注册书童</h2>
      <p className="formsub">新账号赠 $5 试用额度，无需绑卡 · 注册后自动进入下一步</p>
      <div className="err">{err}</div>
      {hint && <div className="hint">{hint}</div>}
      <input placeholder="邮箱或手机号" value={account} onChange={(e) => setAccount(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="验证码" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn secondary" style={{ whiteSpace: "nowrap", height: 46 }} onClick={sendCode} disabled={countdown > 0}>
          {countdown > 0 ? `${countdown}s` : "发送验证码"}
        </button>
      </div>
      <input placeholder="设置密码（至少8位）" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn" onClick={submit}>注册</button>
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
        已有账号？<a href={`/login${qs}`} style={{ color: "var(--glow)" }}>去登录</a>
      </p>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [qs, setQs] = useState("");
  useEffect(() => { setQs(window.location.search); }, []);
  const router = useRouter();

  async function submit() {
    setErr("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next") || "/console";
      router.push(next); router.refresh();
    }
    else setErr((await res.json()).error || "登录失败");
  }

  return (
    <div className="form">
      <h2>欢迎回来</h2>
      <p className="formsub">书童已备好纸墨</p>
      <div className="err">{err}</div>
      <input placeholder="邮箱或手机号" value={account} onChange={(e) => setAccount(e.target.value)} />
      <input placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn" onClick={submit}>登录</button>
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
        没有账号？<a href={`/register${qs}`} style={{ color: "var(--glow)" }}>免费注册，送 $5 额度</a>
      </p>
    </div>
  );
}

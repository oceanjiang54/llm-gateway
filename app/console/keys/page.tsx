"use client";
import { useEffect, useState } from "react";

interface KeyRow { id: string; name: string; prefix: string; disabled: boolean; createdAt: string; lastUsedAt: string | null; }
interface ModelRow { id: string; displayName: string; }

// 剪贴板写入：优先现代 API，失败时回退旧方法
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari 在异步操作后可能拒绝剪贴板API，回退到隐藏textarea方案
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      const sel = document.getSelection();
      const saved = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, text.length); // 显式圈定要复制的内容，防止带走页面选区
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (saved && sel) { sel.removeAllRanges(); sel.addRange(saved); }
      return ok;
    } catch { return false; }
  }
}

// 安全设计：模板不含真实密钥，由用户自行替换（平台仅存密钥哈希，明文不可找回）
function buildCurl(model: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `curl ${origin}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-gw-替换为你的密钥" \\
  -d '{"model": "${model}", "messages": [{"role": "user", "content": "你好，介绍一下你自己"}]}'`;
}

export default function Keys() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [model, setModel] = useState("deepseek-chat");
  const [newKey, setNewKey] = useState("");
  const [name, setName] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function load() {
    const res = await fetch("/api/keys");
    if (res.status === 401) { location.href = "/login"; return; }
    setKeys((await res.json()).keys);
  }

  const [onboarding, setOnboarding] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    // 读取首页模型卡片带来的 ?model= 参数与引导标记
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get("model");
    if (m) setModel(m);
    if (sp.get("onboarding") === "1") setOnboarding(true);
    load();
    fetch("/api/models").then((r) => r.json()).then((d) => setModels(d.models || []));
  }, []);

  // 创建密钥：成功后自动复制并弹窗提示
  async function create() {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "default" }),
    });
    const data = await res.json();
    setNewKey(data.key);
    setName("");
    setCreated(true);
    // 暂存到浏览器本会话，供体验页自动填入（关闭标签即清除，不落库）
    try { sessionStorage.setItem("st_key", data.key); } catch {}
    const ok = await copyText(data.key);
    showToast(ok ? "密钥已创建，并自动复制到剪贴板" : "密钥已创建（自动复制失败，请手动复制）");
    load();
  }

  async function copyKey() {
    const ok = await copyText(newKey);
    showToast(ok ? "密钥已复制到剪贴板" : "复制失败，请手动选中复制");
  }

  async function disable(id: string) {
    await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    showToast("密钥已停用");
    load();
  }

  // 复制命令：复制当前所选模型的 curl 模板（不含真实密钥）
  async function copyCmd() {
    const ok = await copyText(buildCurl(model));
    showToast(ok ? `已复制 ${model} 的调用命令模板，请将密钥替换为你自己的` : "复制失败，请重试");
  }

  // 试用：跳转体验页，带上当前所选模型
  function tryIt() {
    location.href = `/playground?model=${encodeURIComponent(model)}`;
  }

  return (
    <div className="container">
      <h2 className="section-title">API Keys</h2>
      <p className="section-sub">创建即自动复制 · 「试用」直达立即体验 ·「复制命令」获取 curl 模板</p>
      {onboarding && !created && (
        <div className="guidebar">第 2 步 · 创建你的专属密钥：点下方「创建」按钮即可（名称可不填）</div>
      )}
      {onboarding && created && (
        <div className="guidebar done">
          密钥已创建并暂存 ✓ 最后一步：
          <a href={`/playground?model=${encodeURIComponent(model)}`}
            onClick={(e) => { e.preventDefault(); window.location.assign(`/playground?model=${encodeURIComponent(model)}`); }}
            className="btn" style={{ marginLeft: 12, padding: "8px 20px" }}>去体验，直接调用 →</a>
        </div>
      )}

      <div className="card">
        <div className="label">调用模型</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(models.length ? models : [{ id: model, displayName: model }]).map((m) => (
            <button
              key={m.id}
              className={model === m.id ? "btn" : "btn secondary"}
              style={{ padding: "7px 14px", fontSize: 12 }}
              onClick={() => setModel(m.id)}
            >
              {m.displayName}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="label">创建新密钥</div>
        <div style={{ display: "flex", gap: 12 }}>
          <input placeholder="密钥名称（可选）" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 0 }} />
          <button className="btn" onClick={create} style={{ whiteSpace: "nowrap" }}>创建</button>
        </div>
        {newKey && (
          <div className="keybox">
            {newKey}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span className="warn">密钥仅显示这一次，请妥善保存（平台只存哈希，无法找回）</span>
              <button className="btn secondary" onClick={copyKey} style={{ padding: "6px 14px", fontSize: 12 }}>复制密钥</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>名称</th><th>前缀</th><th>创建时间</th><th>最近使用</th><th>状态</th><th style={{ textAlign: "right" }}>操作</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td><code>{k.prefix}</code></td>
                <td>{new Date(k.createdAt).toLocaleDateString("zh-CN")}</td>
                <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("zh-CN") : "—"}</td>
                <td>{k.disabled ? <span style={{ color: "var(--muted)" }}>已停用</span> : <span style={{ color: "var(--teal)" }}>启用中</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {!k.disabled && (
                    <>
                      <button className="btn secondary" onClick={() => disable(k.id)} style={{ padding: "6px 12px", fontSize: 12 }}>停用</button>
                      <button className="btn secondary" onClick={copyCmd} style={{ padding: "6px 12px", fontSize: 12, marginLeft: 8 }}>复制命令</button>
                      <button className="btn" onClick={tryIt} style={{ padding: "6px 12px", fontSize: 12, marginLeft: 8 }}>试用</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>还没有密钥，创建一个开始使用</td></tr>}
          </tbody>
        </table>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

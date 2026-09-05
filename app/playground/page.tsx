"use client";
import { useEffect, useRef, useState } from "react";

interface ModelRow { id: string; displayName: string; inputPerM: number; outputPerM: number; }
interface Usage { prompt_tokens: number; completion_tokens: number; }

// 体验：面向普通用户的一次性体验。输入框 + 结果，代码默认隐藏（「导出代码」按需展开）
export default function Playground() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [model, setModel] = useState("deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const [autoKey, setAutoKey] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; code: number } | null>(null);
  const [stats, setStats] = useState<{ usage?: Usage; costUsd?: number; ms: number } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [toast, setToast] = useState("");
  const outRef = useRef<HTMLDivElement>(null);

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(""), 2600); }

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => setModels(d.models || []));
    const m = new URLSearchParams(window.location.search).get("model");
    if (m) setModel(m);
    // 引导流程：自动填入刚创建的密钥（仅存于本浏览器会话，关闭标签即失效）
    const k = sessionStorage.getItem("st_key");
    if (k) { setApiKey(k); setAutoKey(true); }
  }, []);

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  function curlCode() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `curl ${origin}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-gw-你的密钥" \\
  -d '{"model": "${model}", "stream": true, "messages": [{"role": "user", "content": ${JSON.stringify(prompt || "你好")}}]}'`;
  }

  async function makeCall() {
    const cleanKey = apiKey.replace(/\s+/g, "");
    if (!cleanKey) { setStatus({ ok: false, code: 0 }); setOutput("请先粘贴你的 API Key（在控制台创建）"); return; }
    if (!cleanKey.startsWith("sk-gw-")) { setStatus({ ok: false, code: 0 }); setOutput("密钥格式不对：应以 sk-gw- 开头（在控制台 API Keys 页创建）"); return; }
    if (!prompt.trim()) { setStatus({ ok: false, code: 0 }); setOutput("先在上面输入你想问的内容"); return; }

    setLoading(true); setOutput(""); setStatus(null); setStats(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cleanKey}` },
        body: JSON.stringify({ model, stream: true, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus({ ok: false, code: res.status });
        setOutput(data.error?.message || "调用失败");
        setLoading(false);
        return;
      }
      setStatus({ ok: true, code: 200 });
      // 流式读取：逐字显示，最后一块带 usage 计量
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let usage: Usage | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) setOutput((o) => o + delta);
            if (chunk.usage) usage = chunk.usage;
          } catch {}
        }
        outRef.current?.scrollIntoView({ block: "nearest" });
      }
      const m = models.find((x) => x.id === model);
      const costUsd = m && usage ? (usage.prompt_tokens / 1e6) * m.inputPerM + (usage.completion_tokens / 1e6) * m.outputPerM : undefined;
      setStats({ usage, costUsd, ms: Math.round(performance.now() - t0) });
    } catch (e: any) {
      setStatus({ ok: false, code: 0 });
      setOutput(e instanceof TypeError ? "请求未能发出：密钥中可能含有多余字符，请重新完整复制后再试" : e.message || "网络错误");
    }
    setLoading(false);
  }

  return (
    <div className="container">
      <h2 className="section-title">体验</h2>
      <p className="section-sub">选模型、写问题、看回答——就这么简单。没有密钥？先去控制台创建一个</p>

      <div className="card">
        <div className="label">选择模型</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(models.length ? models : [{ id: model, displayName: model, inputPerM: 0, outputPerM: 0 }]).map((m) => (
            <button key={m.id} className={model === m.id ? "btn" : "btn secondary"}
              style={{ padding: "7px 14px", fontSize: 12 }} onClick={() => setModel(m.id)}>
              {m.displayName}
            </button>
          ))}
        </div>
        <div className="label">API Key {autoKey && <span style={{ color: "var(--teal)" }}>· 已自动填入刚创建的密钥（仅本次会话有效）</span>}</div>
        <input type="password" placeholder="sk-gw-..." value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setAutoKey(false); }} autoComplete="off" />
        {!autoKey && !apiKey && (
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: -4, marginBottom: 12 }}>
            没有密钥？<a href={`/try?model=${encodeURIComponent(model)}`} style={{ color: "var(--glow)" }}>点此一键开通（免费领 $5 额度）→</a>
          </p>
        )}
        <div className="label">你想问什么</div>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
          placeholder="例如：帮我写一封给客户的节日问候邮件"
          style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--line2)", borderRadius: 8, color: "var(--text)", fontSize: 14, padding: "12px 14px", resize: "vertical", outline: "none", marginBottom: 12, lineHeight: 1.7 }} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={makeCall} disabled={loading}>
            {loading ? "书童研墨中…" : "▶ 发起调用"}
          </button>
          <button className="btn ghost" style={{ marginLeft: 0 }}
            onClick={() => showToast("附件功能即将支持：图片、PDF、技能包")}>+ 添加附件</button>
          <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => setShowCode(!showCode)}>
            {showCode ? "收起代码 ▴" : "导出代码 ▾"}
          </button>
        </div>
        {showCode && (
          <div style={{ marginTop: 14 }}>
            <pre>{curlCode()}</pre>
            <button className="btn secondary" style={{ marginTop: 8, padding: "6px 14px", fontSize: 12 }}
              onClick={async () => showToast((await copyText(curlCode())) ? "代码已复制到剪贴板（记得替换密钥）" : "复制失败")}>复制代码</button>
          </div>
        )}
      </div>

      {(status || loading) && (
        <div className="card" ref={outRef}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: status?.ok ? "var(--teal)" : loading ? "var(--muted)" : "var(--red)" }}>
              ● {loading && !status ? "连接中…" : status?.ok ? (loading ? "书童回复中…" : "调用成功") : `调用失败 ${status?.code || ""}`}
            </span>
            {stats && (
              <span style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}>
                {stats.usage ? `input ${stats.usage.prompt_tokens} · output ${stats.usage.completion_tokens} tokens · ` : ""}
                {stats.costUsd != null ? `$${stats.costUsd.toFixed(6)} · ` : ""}{(stats.ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{output}{loading && status?.ok ? "▍" : ""}</p>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

interface ModelRow { id: string; displayName: string; inputPerM: number; outputPerM: number; }
interface CallResult { ok: boolean; status: number; content: string; usage?: { prompt_tokens: number; completion_tokens: number }; costUsd?: number; ms: number; }

// 试笔：贴密钥、改提示词、一次调用一次返回。密钥仅存于页面内存，不落库不缓存
export default function Playground() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [model, setModel] = useState("deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("用一句话介绍南通");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => setModels(d.models || []));
    const m = new URLSearchParams(window.location.search).get("model");
    if (m) setModel(m);
  }, []);

  async function makeCall() {
    // 清洗粘贴内容：去掉所有空白/换行，避免非法字符进入请求头导致浏览器报 TypeError
    const cleanKey = apiKey.replace(/\s+/g, "");
    if (!cleanKey) { setResult({ ok: false, status: 0, content: "请先粘贴你的 API Key（在控制台创建）", ms: 0 }); return; }
    if (!cleanKey.startsWith("sk-gw-")) {
      setResult({ ok: false, status: 0, content: "密钥格式不对：应以 sk-gw- 开头（在控制台 API Keys 页创建）。注意不要粘贴 curl 命令或上游模型的密钥。", ms: 0 });
      return;
    }
    setLoading(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cleanKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, status: res.status, content: data.error?.message || "调用失败", ms });
      } else {
        const usage = data.usage;
        const m = models.find((x) => x.id === model);
        const costUsd = m && usage ? (usage.prompt_tokens / 1e6) * m.inputPerM + (usage.completion_tokens / 1e6) * m.outputPerM : undefined;
        setResult({ ok: true, status: 200, content: data.choices?.[0]?.message?.content ?? "", usage, costUsd, ms });
      }
    } catch (e: any) {
      const msg = e instanceof TypeError
        ? "请求未能发出：密钥中可能含有多余字符，请重新完整复制后再试"
        : e.message || "网络错误";
      setResult({ ok: false, status: 0, content: msg, ms: Math.round(performance.now() - t0) });
    }
    setLoading(false);
  }

  return (
    <div className="container">
      <h2 className="section-title">试笔</h2>
      <p className="section-sub">贴上你的密钥，一键体验模型调用——无需写代码。没有密钥？先去控制台创建一个</p>

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
        <div className="label">API Key（仅在本页使用，不会被保存）</div>
        <input type="password" placeholder="sk-gw-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        <div className="label">请求（提示词可编辑）</div>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.9, color: "#c6d4f0" }}>
          {"{"}<br />
          &nbsp;&nbsp;"model": <span style={{ color: "var(--teal)" }}>"{model}"</span>,<br />
          &nbsp;&nbsp;"messages": [{"{"} "role": "user", "content":
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
            style={{ display: "block", width: "100%", margin: "6px 0", background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 8, color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12.5, padding: "8px 10px", resize: "vertical", outline: "none" }} />
          {"}"}]<br />{"}"}
        </div>
        <button className="btn" onClick={makeCall} disabled={loading} style={{ marginTop: 14 }}>
          {loading ? "调用中…" : "▶ 发起调用"}
        </button>
      </div>

      {result && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: result.ok ? "var(--teal)" : "var(--red)" }}>
              ● {result.ok ? "调用成功" : "调用失败"} {result.status || ""}
            </span>
            <span style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}>
              {result.usage ? `input ${result.usage.prompt_tokens} · output ${result.usage.completion_tokens} tokens · ` : ""}
              {result.costUsd != null ? `$${result.costUsd.toFixed(6)} · ` : ""}{(result.ms / 1000).toFixed(1)}s
            </span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.content}</p>
        </div>
      )}
    </div>
  );
}

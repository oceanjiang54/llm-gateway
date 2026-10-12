"use client";
import { useState } from "react";

// 代码块：可选多语言切换 + 一键复制（只复制模板，密钥由用户自己填写）
export default function Code({ tabs, code, label }: { tabs?: { label: string; code: string }[]; code?: string; label?: string }) {
  const list = tabs ?? [{ label: label ?? "", code: code ?? "" }];
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(list[i].code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="codebox">
      <div className="codebar">
        <div className="codetabs" role="tablist">
          {list.map((t, k) => t.label && (
            <button key={t.label} role="tab" aria-selected={k === i} className={k === i ? "on" : ""} onClick={() => setI(k)}>{t.label}</button>
          ))}
        </div>
        <button className="codecopy" onClick={copy}>{copied ? "已复制" : "复制"}</button>
      </div>
      <pre data-lang={list[i].label}>{list[i].code}</pre>
    </div>
  );
}

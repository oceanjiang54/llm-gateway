import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { avatarOf } from "@/lib/brand";
import { yuan } from "@/lib/currency";
import { samples } from "@/lib/docs-samples";
import Code from "@/components/docs/Code";

export const dynamic = "force-dynamic";

// 模型详情：简介、价格与用量估算、调用示例、立即试用
export default async function ModelDetail({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const m = (await db.select().from(schema.models).where(eq(schema.models.id, id)))[0];
  if (!m || m.status !== "live" || !m.enabled) notFound();

  const host = headers().get("host") || "shutong.ai";
  const proto = host.includes("localhost") || /^\d/.test(host) ? "http" : "https";
  const base = `${proto}://${host}`;
  const a = avatarOf(m.provider, m.displayName);

  // 估算：一次典型对话约 500 输入 + 300 输出 tokens
  const perCall = (500 / 1e6) * m.inputPerM + (300 / 1e6) * m.outputPerM;

  const s = samples(base, m.id);

  return (
    <div className="wrap" style={{ padding: "40px 24px 72px", maxWidth: 920 }}>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
        <Link href="/models" style={{ color: "var(--muted)" }}>模型市场</Link> / {m.displayName}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <span className="av" style={{ background: a.bg, color: a.fg, width: 52, height: 52, borderRadius: 12, fontSize: 22 }}>{a.ch}</span>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25 }}>{m.displayName}</h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>{m.vendor} · {m.category}</p>
        </div>
      </div>
      <p style={{ fontSize: 16, color: "var(--sub)", lineHeight: 1.85, marginBottom: 24, maxWidth: 640 }}>{m.description}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <Link href={`/try?model=${encodeURIComponent(m.id)}`} className="btn">立即试用 →</Link>
        <Link href={`/playground?model=${encodeURIComponent(m.id)}`} className="btn ghost" style={{ marginLeft: 0 }}>在体验页打开</Link>
      </div>

      <div className="grid3" style={{ marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="label">输入价格</div>
          <div className="stat">¥{m.inputPerM.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>每百万 tokens</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="label">输出价格</div>
          <div className="stat">¥{m.outputPerM.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>每百万 tokens</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="label">一次典型对话约</div>
          <div className="stat">{yuan(perCall)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>按 500 输入 + 300 输出估算</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>模型 ID</h3>
        <p style={{ fontSize: 13.5, color: "var(--sub)", marginBottom: 14 }}>请求时把 <code>model</code> 设为 <code>{m.id}</code>，其余参数与 OpenAI Chat Completions 一致。</p>
        <Code tabs={[{ label: "cURL", code: s.chatCurl }, { label: "Python", code: s.chatPy }, { label: "Node.js", code: s.chatNode }]} />
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 14 }}>完整接入步骤见 <Link href="/docs" style={{ color: "var(--accent)" }}>三分钟上手</Link>，错误码见 <Link href="/docs/errors" style={{ color: "var(--accent)" }}>错误码</Link>。</p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { avatarOf } from "@/lib/brand";

export interface ModelInfo {
  id: string; provider: string; displayName: string; vendor: string; category: string;
  description: string; status: string; inputPerM: number; outputPerM: number;
}

// 模型市场卡片：可调用的链接到详情页；即将接入的显示占位
export default function ModelCard({ m }: { m: ModelInfo }) {
  const a = avatarOf(m.provider, m.displayName);
  const head = (
    <div className="top">
      <span className="av" style={{ background: a.bg, color: a.fg }}>{a.ch}</span>
      <div><div className="nm">{m.displayName}</div><div className="vd">{m.vendor} · {m.category}</div></div>
    </div>
  );
  if (m.status === "coming") {
    return (
      <div className="mcard coming">
        {head}
        <p className="desc">{m.description}</p>
        <div className="meta"><span className="tag amber">即将接入</span><span>敬请期待</span></div>
      </div>
    );
  }
  return (
    <Link href={`/models/${m.id}`} className="mcard">
      {head}
      <p className="desc">{m.description}</p>
      <div className="meta"><span><b>¥{m.inputPerM.toFixed(2)}</b> / <b>¥{m.outputPerM.toFixed(2)}</b></span><span className="go">查看详情 →</span></div>
    </Link>
  );
}

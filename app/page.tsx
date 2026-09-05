import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

// 模型标签映射：不同定位不同徽标
const TAGS: Record<string, { text: string; cls: string }> = {
  "claude-sonnet-4-5": { text: "旗舰", cls: "teal" },
  "claude-haiku-4-5": { text: "轻快", cls: "blue" },
  "deepseek-chat": { text: "性价比", cls: "blue" },
};

export default async function Home() {
  const models = await db.select().from(schema.models).where(eq(schema.models.enabled, true));
  return (
    <main>
      <section className="hero">
        <h1>AI 书童<span className="dot">，</span>陪伴企业成长<span className="dot">。</span></h1>
        <p className="sub">统一 API 网关 · 智能模型路由 · 企业定制化全面AI升级</p>
        <Link href="/register" className="btn">免费注册，领 $5 额度</Link>
        <Link href="/docs" className="btn ghost">查看文档</Link>
        <div className="statusline">
          <span><span className="dot-teal">●</span> OpenAI 兼容格式</span>
          <span><span className="dot-blue">●</span> 流式输出</span>
          <span><span className="dot-purple">●</span> 数据不出域可选</span>
        </div>
      </section>

      <div className="container" id="models">
        <h2 className="section-title">支持的模型</h2>
        <p className="section-sub">价格为每百万 tokens（美元），点击卡片选择模型，直达控制台发起调用</p>
        <div className="model-grid">
          {models.map((m) => {
            const tag = TAGS[m.id] ?? { text: m.provider, cls: "blue" };
            return (
              <Link href={`/console/keys?model=${m.id}`} className="model-card" key={m.id}>
                <div className="head">
                  <span className="name">{m.displayName}</span>
                  <span className={`tag ${tag.cls}`}>{tag.text}</span>
                </div>
                <div className="id">{m.id}</div>
                <div className="price">
                  <span>输入 <b>${m.inputPerM.toFixed(2)}</b></span>
                  <span>输出 <b>${m.outputPerM.toFixed(2)}</b></span>
                </div>
              </Link>
            );
          })}
          <Link href="/docs" className="model-card featured">
            <div className="head">
              <span className="name">智能路由</span>
              <span className="tag purple">auto · 规划中</span>
            </div>
            <div className="id">{'model: "auto"'}</div>
            <div className="price"><span>按任务难度自动选用最合适的模型，兼顾质量与成本</span></div>
          </Link>
        </div>
      </div>
    </main>
  );
}

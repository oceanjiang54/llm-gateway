import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { avatarOf, ECOSYSTEM } from "@/lib/brand";
import ModelCard from "@/components/ModelCard";
import LeadButton from "@/components/LeadButton";
import AgentDemos from "@/components/AgentDemos";
import HeroArchitecture from "@/components/HeroArchitecture";

export const dynamic = "force-dynamic";

const CAPS = [
  { en: "Unified API", h: "一个接口，接入多个模型", p: "OpenAI 兼容格式，改一行 base_url 即可在不同模型间切换，不必逐家对接。" },
  { en: "Model Routing", h: "按任务选对模型", p: "根据任务难度、价格和模型能力分配合适的模型，效果与成本兼顾。" },
  { en: "Usage & Billing", h: "调用与成本一本账", p: "统一管理调用记录、Token 用量与费用，按人、按部门核算一目了然。" },
  { en: "Global Access", h: "连接中国与全球生态", p: "国内外主流模型一站可用，跨境访问与合规由平台处理。" },
];

const FLOW = [
  { h: "业务场景诊断", p: "找到 AI 最能产生价值的环节" },
  { h: "数据与流程梳理", p: "盘点文档、系统与现有流程" },
  { h: "Workflow 设计", p: "把业务拆成 AI 可执行的步骤" },
  { h: "Agent 构建", p: "选模型、接知识库、配工具" },
  { h: "系统连接", p: "对接 ERP、CRM、OA 等企业系统" },
  { h: "上线与持续优化", p: "按业务结果迭代效果" },
];

const WHY = [
  { h: "全球模型", p: "统一接入国内外主流 AI 模型，一个账号全部可用。" },
  { h: "开放架构", p: "兼容主流 API 与企业现有系统，可私有化部署。" },
  { h: "FDE 交付", p: "不是只卖 API，而是派工程师参与业务落地。" },
  { h: "持续运营", p: "上线不是终点，根据业务结果持续优化。" },
];

export default async function Home() {
  const models = await db.select().from(schema.models)
    .where(inArray(schema.models.status, ["live", "coming"]))
    .orderBy(asc(schema.models.sortOrder));
  const featured = models.slice(0, 8);

  return (
    <main>
      {/* 01 首屏 */}
      <div className="wrap">
        <section className="home-hero">
          <div>
            <span className="pill">AI 基础设施 + 企业 AI 落地</span>
            <h1>连接全球 AI 模型<br />与企业真实业务</h1>
            <p className="lede">统一接入全球主流 AI 模型，并通过 Agent、Workflow 与 FDE 服务，帮助企业完成从模型调用到业务落地。</p>
            <div className="ctas">
              <Link href="/try" className="btn">获取 API Key →</Link>
              <LeadButton className="btn ghost" source="首屏">咨询 AI 落地</LeadButton>
            </div>
            <p className="ctanote">开发者注册即送 ¥30 额度 · 企业客户 1 个工作日内响应</p>
          </div>
          <HeroArchitecture />
        </section>
        <div className="eco">
          <span className="lbl">模型生态</span>
          {ECOSYSTEM.map((m) => {
            const a = avatarOf(m.provider, m.name);
            return <span className="chip" key={m.name}><span className="av" style={{ background: a.bg, color: a.fg }}>{a.ch}</span>{m.name}</span>;
          })}
        </div>
      </div>

      {/* 02 模型市场 */}
      <section className="sec alt" id="models">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>一个入口，连接全球 AI 模型</h2>
              <p>价格为每百万 tokens（人民币，输入 / 输出），按实际用量计费。</p>
            </div>
            <Link href="/models" className="more">查看全部模型 →</Link>
          </div>
          <div className="mkt-grid">
            {featured.map((m) => <ModelCard key={m.id} m={m} />)}
          </div>
        </div>
      </section>

      {/* 03 AI 基础设施 */}
      <section className="sec" id="infra">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>不用重复建设你的 AI 基础设施</h2>
              <p>接入、选型、计费与跨境访问开箱即用。一个账号覆盖国内外主流模型，团队只需专注业务本身。</p>
            </div>
          </div>
          <div className="cap-grid">
            {CAPS.map((c) => (
              <div className="cap" key={c.en}><div className="en">{c.en}</div><h3>{c.h}</h3><p>{c.p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 企业 AI 落地 */}
      <section className="sec alt" id="solutions">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>模型只是开始，让 AI 真正进入业务</h2>
              <p>我们的 FDE（驻场工程师）与企业团队共同完成 AI 从需求到上线的全过程。</p>
            </div>
            <LeadButton className="btn secondary" source="落地流程">预约诊断</LeadButton>
          </div>
          <ol className="flow" style={{ listStyle: "none" }}>
            {FLOW.map((s, i) => (
              <li className="st" key={s.h}>
                <div className="n">0{i + 1}</div><h3>{s.h}</h3><p>{s.p}</p>
              </li>
            ))}
          </ol>
          <p className="punch">我们不仅提供 AI 模型 API，<span>还帮助企业把 AI 真正接入业务。</span></p>
        </div>
      </section>

      {/* 05 Agent & Workflow */}
      <section className="sec" id="agents">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>把模型变成可以工作的 AI</h2>
              <p>模型 → Agent → 工作。点开卡片，看一个 Agent 如何完成一件具体的事。</p>
            </div>
          </div>
          <AgentDemos />
        </div>
      </section>

      {/* 06 为什么选择我们 */}
      <section className="sec alt">
        <div className="wrap">
          <div className="sec-head"><div><h2>为什么选择书童</h2></div></div>
          <div className="why-grid">
            {WHY.map((w) => <div className="why" key={w.h}><h3>{w.h}</h3><p>{w.p}</p></div>)}
          </div>
          <p className="punch">不只是提供模型，<span>而是帮助企业完成最后一公里的 AI 落地。</span></p>
        </div>
      </section>

      {/* 07 底部 CTA */}
      <section className="cta-band">
        <div className="wrap">
          <h2>从调用第一个模型，到部署第一个 AI 工作流</h2>
          <div className="cta-duo">
            <div className="box">
              <div className="who">开发者</div>
              <div className="what">注册即送 ¥30 额度，<br />3 分钟跑通第一次调用</div>
              <Link href="/try" className="btn">获取 API Key →</Link>
            </div>
            <div className="box">
              <div className="who">企业客户</div>
              <div className="what">FDE 团队 1 个工作日内联系你，<br />一起找到 AI 的落地点</div>
              <LeadButton className="btn ghost" source="底部">预约 AI 落地咨询</LeadButton>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

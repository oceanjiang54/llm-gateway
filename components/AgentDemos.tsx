"use client";
import { useEffect, useRef, useState } from "react";

// 首页「把模型变成可以工作的 AI」：4 张 Agent 卡片，点开按脚本逐条播放模拟对话（全部 Mock 数据）
type Step = { who: "user" | "bot" | "tool"; text: string; src?: string };
interface Agent { key: string; icon: string; bg: string; fg: string; title: string; desc: string; peek: string; model: string; steps: Step[] }

const AGENTS: Agent[] = [
  {
    key: "kb", icon: "知", bg: "#e9effc", fg: "#2c5cc5",
    title: "企业知识助手", desc: "连接企业文档、知识库和内部数据，员工随问随答，答案可追溯来源。",
    peek: "问：新员工入职要做哪些事？\n答：签署合同、开通账号…",
    model: "qwen-plus",
    steps: [
      { who: "user", text: "新员工入职第一周需要完成哪些事项？" },
      { who: "tool", text: "→ 检索知识库：《员工手册》《入职指引》" },
      { who: "bot", text: "第一周需要完成：\n· 签署劳动合同与保密协议\n· 领取办公设备，开通邮箱和内部系统账号\n· 参加公司制度与信息安全培训\n· 与直属主管确认试用期目标", src: "来源：《入职指引》第 1 节" },
      { who: "user", text: "试用期一般多长？" },
      { who: "bot", text: "一般为 3 个月，具体以劳动合同约定为准。试用期结束前两周会安排转正评估。", src: "来源：《员工手册》第 2 章" },
    ],
  },
  {
    key: "sales", icon: "销", bg: "#fcf1e1", fg: "#a5610a",
    title: "销售 Agent", desc: "整理客户信息与跟进记录，提醒该联系谁、该说什么。",
    peek: "今日待跟进 3 位\n● 客户 A 报价已发 5 天",
    model: "deepseek-chat",
    steps: [
      { who: "user", text: "今天我该先跟进哪些客户？" },
      { who: "tool", text: "→ 读取客户管理系统：本周跟进记录与未回复的报价" },
      { who: "bot", text: "建议优先 3 位：\n\n1. 客户 A · 报价已发出 5 天未回复，金额最大\n2. 客户 B · 昨天询问过交付周期，意向较强\n3. 客户 C · 试用已结束，适合推进签约" },
      { who: "user", text: "帮我给客户 A 写一条跟进消息" },
      { who: "bot", text: "您好，上周发给您的方案和报价不知是否方便看了？关于交付周期和付款方式我们都可以再细化，您这周哪天方便，我们约个时间沟通一下？" },
    ],
  },
  {
    key: "data", icon: "数", bg: "#e5f5ee", fg: "#0f7d5a",
    title: "数据 Agent", desc: "读取业务数据，自动生成分析结论和周报，不用再手工拉表。",
    peek: "本周营收 ↑12%\n异常：某区域退款率偏高",
    model: "claude-sonnet-4-5",
    steps: [
      { who: "user", text: "帮我看看本周的经营数据，有什么异常？" },
      { who: "tool", text: "→ 查询业务数据：订单、营收、退款（本周）" },
      { who: "bot", text: "本周概况：\n· 营收环比 ↑12%\n· 订单量 ↑8%，客单价基本持平\n\n需要关注：\n· 某区域退款率是平均水平的 2 倍，集中在周三\n· 可能与当天物流延误有关，建议核对发货记录" },
      { who: "user", text: "生成一份周报发给管理层" },
      { who: "bot", text: "已生成本周经营周报，包含营收趋势、区域对比和 3 条改进建议。是否现在发送？" },
    ],
  },
  {
    key: "content", icon: "文", bg: "#efebfc", fg: "#5d43c9",
    title: "内容 Agent", desc: "从资料调研、初稿生成到合规审核，一条流程跑完内容生产。",
    peek: "✓ 资料调研\n✓ 初稿生成\n◐ 合规审核中",
    model: "kimi-k2.6",
    steps: [
      { who: "user", text: "写一篇介绍我们新产品的公众号文章" },
      { who: "tool", text: "→ 步骤 1/3 资料调研：读取产品介绍、功能清单与用户反馈" },
      { who: "tool", text: "→ 步骤 2/3 初稿生成：约 1,800 字，含 4 个小标题" },
      { who: "tool", text: "→ 步骤 3/3 合规审核：检查广告法用语，改写 2 处绝对化表述" },
      { who: "bot", text: "初稿已完成：《更快、更省、更好用：新品上手指南》\n\n已按广告法改写绝对化用语，建议配图 4 张。需要再生成一个朋友圈短版本吗？" },
    ],
  },
];

export default function AgentDemos() {
  const [active, setActive] = useState<Agent | null>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // 逐条播放：用户消息快、工具步骤中、回答稍慢，模拟真实节奏
  useEffect(() => {
    if (!active || shown >= active.steps.length) return;
    const next = active.steps[shown];
    const delay = shown === 0 ? 300 : next.who === "user" ? 900 : next.who === "tool" ? 700 : 1200;
    timer.current = setTimeout(() => setShown((s) => s + 1), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [active, shown]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [shown]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const open = (a: Agent) => { setShown(0); setActive(a); };
  const playing = active && shown < active.steps.length;

  return (
    <>
      <div className="agent-grid">
        {AGENTS.map((a) => (
          <button key={a.key} className="acard" onClick={() => open(a)} aria-label={`播放演示：${a.title}`}>
            <span className="av" style={{ background: a.bg, color: a.fg }}>{a.icon}</span>
            <h3>{a.title}</h3>
            <p>{a.desc}</p>
            <div className="peek" style={{ whiteSpace: "pre-line" }}>{a.peek}</div>
            <span className="play">▶ 观看演示</span>
          </button>
        ))}
      </div>

      {active && (
        <div className="modal-bg" onClick={() => setActive(null)}>
          <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="demo-title" onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={() => setActive(null)} aria-label="关闭">×</button>
            <h3 id="demo-title">{active.title}</h3>
            <p className="msub">演示数据 · 底层模型 <code>{active.model}</code> 经书童网关调用</p>
            <div className="demo-log" ref={logRef} style={{ maxHeight: "52vh", overflowY: "auto" }}>
              {active.steps.slice(0, shown).map((s, i) => (
                <div key={i} className={`bub ${s.who}`}>
                  {s.text}
                  {s.src && <span className="src">{s.src}</span>}
                </div>
              ))}
              {playing && <div className="bub tool">{active.steps[shown].who === "user" ? "…" : "书童处理中…"}</div>}
            </div>
            <div className="demo-foot">
              <span>想把这样的 Agent 接进你的业务？</span>
              {playing
                ? <button className="btn secondary" onClick={() => setShown(active.steps.length)}>跳过动画</button>
                : <button className="btn secondary" onClick={() => setShown(0)}>重新播放</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 首屏右侧：平台五层架构渲染图（AI 模型 → AI 基础设施 → Agent 与工作流 → FDE 交付 → 行业解决方案）
export default function HeroArchitecture() {
  return (
    <figure className="hero-art">
      <img
        src="/hero-arch.webp"
        width={1198}
        height={1313}
        alt="书童平台架构：AI 模型经 AI 基础设施（统一 API 接入、智能路由调度、用量计量与计费）、AI Agent 与工作流、FDE 交付实施，落地到制造、政务、零售、金融、教育等行业解决方案"
        fetchPriority="high"
      />
    </figure>
  );
}

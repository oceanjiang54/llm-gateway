import Link from "next/link";
import LeadButton from "./LeadButton";

// 页脚站点地图：只放已经上线的页面；企业相关入口走留资弹窗
const COLS: { t: string; items: ({ href: string; label: string } | { lead: string; label: string })[] }[] = [
  { t: "产品", items: [
    { href: "/models", label: "模型市场" },
    { href: "/playground", label: "体验中心" },
    { href: "/docs/claude-code", label: "Claude Code 接入" },
    { href: "/docs/cli", label: "命令行工具" },
  ] },
  { t: "解决方案", items: [
    { href: "/#solutions", label: "企业 AI 落地" },
    { href: "/#agents", label: "Agent 演示" },
    { lead: "页脚·私有化部署", label: "私有化部署" },
  ] },
  { t: "开发者", items: [
    { href: "/docs", label: "三分钟上手" },
    { href: "/docs/chat", label: "API 参考" },
    { href: "/docs/errors", label: "错误码" },
    { href: "/docs/pricing", label: "计费说明" },
  ] },
  { t: "关于", items: [
    { href: "/about", label: "团队介绍" },
    { lead: "页脚·企业合作", label: "企业合作" },
    { href: "/register", label: "免费注册" },
    { href: "/console", label: "控制台" },
  ] },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="sf-inner">
        <div className="sf-brand">
          <Link href="/" className="logo"><span className="seal">書</span>书童 <span className="en">ShuTong</span></Link>
          <p>连接全球 AI 模型与企业真实业务</p>
          <p className="sf-note">AI 基础设施 · 企业 AI 落地</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.t} className="sf-col" aria-label={c.t}>
            <div className="sf-t">{c.t}</div>
            {c.items.map((i) => "href" in i
              ? <Link key={i.label} href={i.href}>{i.label}</Link>
              : <LeadButton key={i.label} className="sf-link" source={i.lead}>{i.label}</LeadButton>)}
          </nav>
        ))}
      </div>
      <div className="sf-bottom">
        <span>© {new Date().getFullYear()} 书童 ShuTong</span>
        <span>原型演示版 · 上线前将完成生成式AI服务备案</span>
      </div>
    </footer>
  );
}

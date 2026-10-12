import "./globals.css";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth";
import { isAdminAccount } from "@/lib/admin";
import { db, schema } from "@/lib/db";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "书童 ShuTong · 大模型统一网关",
  description: "连接全球 AI 模型与企业真实业务：统一接入主流大模型，并通过 Agent、Workflow 与 FDE 服务帮助企业完成 AI 落地。",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  let account = "";
  let isAdmin = false;
  if (userId) {
    const u = (await db.select({ account: schema.users.account }).from(schema.users).where(eq(schema.users.id, userId)))[0];
    if (u) { account = u.account; isAdmin = isAdminAccount(u.account); }
  }
  const loggedIn = !!account;
  return (
    <html lang="zh">
      <body>
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="seal">書</span>
            书童 <span className="en">ShuTong</span>
          </Link>
          <div className="links">
            <Link href="/models">模型市场</Link>
            <Link href="/#solutions">解决方案</Link>
            <Link href="/playground">体验</Link>
            <Link href="/docs">文档</Link>
            {loggedIn ? (
              <>
                <Link href="/console" className="cta">控制台</Link>
                <details className="acct">
                  <summary>用户中心 ▾</summary>
                  <div className="menu">
                    <div className="whoami">{account}</div>
                    <Link href="/console">控制台</Link>
                    <Link href="/console/keys">API Keys</Link>
                    {isAdmin && <Link href="/admin" style={{ color: "var(--purple)" }}>管理后台</Link>}
                    <a href="/logout" className="danger">退出登录</a>
                  </div>
                </details>
              </>
            ) : (
              <>
                <Link href="/login">登录</Link>
                <Link href="/register" className="cta">免费注册</Link>
              </>
            )}
          </div>
        </nav>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

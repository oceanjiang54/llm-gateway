import "./globals.css";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth";
import { isAdminAccount } from "@/lib/admin";
import { db, schema } from "@/lib/db";

export const metadata = {
  title: "书童 ShuTong · 大模型统一网关",
  description: "AI 书童，陪伴企业成长。统一 API 网关 · 智能模型路由 · 按 token 透明计费",
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
            <Link href="/#models">模型</Link>
            <Link href="/playground">体验</Link>
            <Link href="/guide">接入</Link>
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
        <footer className="footer">
          <span>书童 ShuTong · 研墨备纸，百模听差</span>
          <span>原型演示版 · 上线前将完成生成式AI服务备案</span>
        </footer>
      </body>
    </html>
  );
}

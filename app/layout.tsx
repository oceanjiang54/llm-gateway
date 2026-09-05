import "./globals.css";
import Link from "next/link";
import { getSessionUserId } from "@/lib/auth";
import { isAdminAccount } from "@/lib/admin";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const metadata = {
  title: "书童 ShuTong · 大模型统一网关",
  description: "一个 API 唤来百家大模型。OpenAI 兼容 · 智能路由 · 按 token 透明计费",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  let isAdmin = false;
  if (userId) {
    const u = (await db.select({ account: schema.users.account }).from(schema.users).where(eq(schema.users.id, userId)))[0];
    isAdmin = !!u && isAdminAccount(u.account);
  }
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
            <Link href="/docs">文档</Link>
            <Link href="/playground">试笔</Link>
            {userId ? (
              <>
                <Link href="/console/keys">API Keys</Link>
                {isAdmin && <Link href="/admin" style={{ color: "var(--purple)" }}>管理</Link>}
                <Link href="/console" className="cta">控制台</Link>
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

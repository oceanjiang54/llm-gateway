import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "命令行 shutong · 书童文档" };

export default function CliDoc() {
  const s = samples(siteBase());
  return (
    <>
      <h1>命令行 shutong</h1>
      <p className="lead">在终端里选模型、流式对话，默认开启平台记忆。单文件、零依赖，需要 Node.js 18 以上。</p>

      <h2>安装</h2>
      <Code label="Shell" code={s.cliInstall} />
      <p>配置保存在本机 <code>~/.shutong/config.json</code>，仅当前用户可读。</p>

      <h2>使用</h2>
      <Code label="Shell" code={s.cliUse} />

      <h2>对话内命令</h2>
      <table>
        <tbody>
          <tr><td style={{ width: 120 }}><code>/model</code></td><td>切换模型</td></tr>
          <tr><td><code>/new</code></td><td>开始新会话</td></tr>
          <tr><td><code>/history</code></td><td>查看并继续历史会话</td></tr>
          <tr><td><code>/memory</code></td><td>开关平台记忆</td></tr>
          <tr><td><code>/help</code></td><td>查看帮助</td></tr>
          <tr><td><code>/exit</code></td><td>退出</td></tr>
        </tbody>
      </table>
      <DocNext href="/docs/cli" />
    </>
  );
}

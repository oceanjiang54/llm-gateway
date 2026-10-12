import Link from "next/link";
import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claude Code 接入 · 书童文档" };

export default function ClaudeCodeDoc() {
  const s = samples(siteBase());
  return (
    <>
      <h1>Claude Code 接入</h1>
      <p className="lead">Claude Code（含 VS Code 插件）支持企业网关。设置两个环境变量后照常使用 <code>claude</code>：读写项目文件、修改代码、运行命令的能力不变，但每次调用都用书童密钥鉴权、按书童价格以人民币计费，并受账户余额与每日限额约束。</p>

      <h2>终端</h2>
      <Code label="Shell" code={s.claudeCode} />
      <p>如果之前登录过 Anthropic 账号，请先在 Claude Code 里执行 <code>/logout</code>，确保走的是书童密钥。</p>
      <Code label="Shell" code={s.claudeCodeDiscovery} />

      <h2>VS Code 插件</h2>
      <Code label="JSON" code={s.claudeCodeVscode} />

      <h2>验证连通</h2>
      <p>不启动 Claude Code，也可以直接用 Anthropic Messages 格式测试：</p>
      <Code label="cURL" code={s.claudeCodeCheck} />

      <h2>说明</h2>
      <ul>
        <li>此入口兼容 Anthropic Messages API（<code>/v1/messages</code>、<code>/v1/messages/count_tokens</code>、<code>/v1/models</code>），只支持 Claude 系列模型。</li>
        <li>提示缓存的写入与命中分别计价，价格见 <Link href="/docs/pricing">计费说明</Link>。</li>
        <li>使用其他模型（DeepSeek、Qwen、Kimi）请走 <Link href="/docs/chat">对话补全</Link> 接口或 <Link href="/docs/cli">命令行 shutong</Link>。</li>
      </ul>
      <DocNext href="/docs/claude-code" />
    </>
  );
}

import Link from "next/link";
import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";
import { CODEX_MODELS } from "@/lib/openai-pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Codex 接入 · 书童文档" };

export default function CodexDoc() {
  const s = samples(siteBase());
  return (
    <>
      <h1>Codex 接入</h1>
      <p className="lead">OpenAI 的 Codex CLI 支持自定义模型服务商。配置好书童后，用 <code>codex-st</code> 启动：读写文件、改代码、跑命令的能力不变，调用经书童鉴权、按人民币计费，普通的 <code>codex</code> 命令不受影响。</p>

      <h2>1. 安装 Codex</h2>
      <Code label="Shell" code={s.codexInstall} />

      <h2>2. 添加书童服务商与配置档</h2>
      <Code label="Shell" code={s.codexConfig} />
      <p>Codex 只支持 OpenAI Responses 格式，书童的 <code>/api/openai/v1</code> 入口就是为它准备的。默认模型可以在 <code>shutong.config.toml</code> 里改。</p>

      <h2>3. 添加 codex-st 命令</h2>
      <Code label="Shell" code={s.codexSt} />
      <p>已经配置过 <Link href="/docs/claude-code">claude-st</Link> 的，密钥文件不用重复创建。</p>

      <h2>4. 使用</h2>
      <Code label="Shell" code={s.codexUse} />

      <h2>可用模型</h2>
      <table>
        <tbody>
          {CODEX_MODELS.map((m) => <tr key={m.id}><td><code>{m.id}</code></td><td>{m.name}</td></tr>)}
        </tbody>
      </table>
      <p>价格见 <Link href="/docs/pricing">计费说明</Link>。缓存命中的输入按低价计费，Codex 长会话会大量命中缓存。</p>

      <h2>验证连通</h2>
      <p>不启动 Codex，也可以直接用 Responses 格式测试：</p>
      <Code label="cURL" code={s.codexCheck} />
      <DocNext href="/docs/codex" />
    </>
  );
}

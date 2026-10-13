import Link from "next/link";
import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";
import { SIGNUP_BONUS_CNY } from "@/lib/currency";

export const dynamic = "force-dynamic";

// 文档中心首页：三分钟上手
export default function QuickStart() {
  const base = siteBase();
  const s = samples(base);
  return (
    <>
      <h1>三分钟上手</h1>
      <p className="lead">书童提供 OpenAI 兼容的统一接口：一个 API Key、一个 Base URL，即可调用 DeepSeek、Qwen、Kimi、豆包、Claude、GPT、Gemini 等模型，按实际用量以人民币计费。</p>

      <h2 className="docs-step"><span className="n">1</span>获取 API Key</h2>
      <p><Link href="/register">注册账号</Link>（赠送 ¥{SIGNUP_BONUS_CNY} 试用额度），然后在 <Link href="/console/keys">控制台 → API Keys</Link> 创建密钥。密钥形如 <code>sk-gw-…</code>，只在创建时显示一次，请保存到密码管理器或环境变量，不要写进代码仓库。</p>
      <Code label="Shell" code={s.envKey} />

      <h2 className="docs-step"><span className="n">2</span>选择接入方式</h2>
      <h3>路径 A：在代码中调用</h3>
      <p>已有 OpenAI SDK 的项目，只需要改 Base URL 和 API Key：</p>
      <table>
        <tbody>
          <tr><td style={{ width: 120 }}>Base URL</td><td><code>{base}/api/v1</code></td></tr>
          <tr><td>鉴权</td><td><code>Authorization: Bearer sk-gw-…</code></td></tr>
          <tr><td>协议</td><td>OpenAI Chat Completions 兼容</td></tr>
          <tr><td>推荐首个模型</td><td><code>deepseek-chat</code>（价格低、速度快）；全部模型见 <Link href="/models">模型市场</Link></td></tr>
        </tbody>
      </table>

      <p><b>先检查 Key 是否可用</b>：能列出模型就说明 Key 和网络都没问题。</p>
      <Code tabs={[{ label: "cURL", code: s.modelsCurl }, { label: "Python", code: s.modelsPy }, { label: "Node.js", code: s.modelsNode }]} />

      <p><b>发出第一次请求</b>：</p>
      <Code tabs={[{ label: "cURL", code: s.chatCurl }, { label: "Python", code: s.chatPy }, { label: "Node.js", code: s.chatNode }]} />
      <p style={{ fontSize: 13.5 }}>Python 需要 <code>pip install openai</code>；Node.js 需要 <code>npm install openai</code>，并把代码保存为 <code>.mjs</code> 文件运行。</p>

      <h3>路径 B：在工具中使用</h3>
      <div className="dcards">
        <Link href="/docs/claude-code" className="dcard"><b>Claude Code</b><span>设置两个环境变量，让 Claude Code 的调用经书童鉴权与计费。</span></Link>
        <Link href="/docs/codex" className="dcard"><b>Codex</b><span>为 OpenAI Codex CLI 添加书童服务商，用 codex-st 启动。</span></Link>
        <Link href="/docs/cli" className="dcard"><b>命令行 shutong</b><span>在终端里选模型、对话，默认开启平台记忆。</span></Link>
      </div>

      <h2 className="docs-step"><span className="n">3</span>调用没有成功？</h2>
      <table>
        <thead><tr><th style={{ width: 90 }}>状态码</th><th>原因</th><th>处理</th></tr></thead>
        <tbody>
          <tr><td><code>401</code></td><td>API Key 无效或已停用</td><td>检查是否完整复制了 <code>sk-gw-…</code>，或在控制台新建一个</td></tr>
          <tr><td><code>402</code></td><td>账户余额不足</td><td>联系我们充值</td></tr>
          <tr><td><code>404</code></td><td>模型 ID 写错</td><td>用上面的模型列表接口核对 <code>model</code></td></tr>
          <tr><td><code>503</code></td><td>该模型暂不可用</td><td>换用其他模型，或稍后再试</td></tr>
        </tbody>
      </table>
      <p>完整列表见 <Link href="/docs/errors">错误码</Link>。</p>

      <h2>继续探索</h2>
      <div className="dcards">
        <Link href="/docs/chat" className="dcard"><b>对话补全</b><span>请求参数、响应结构与多轮对话。</span></Link>
        <Link href="/docs/streaming" className="dcard"><b>流式输出</b><span>边生成边返回，首字更快。</span></Link>
        <Link href="/docs/memory" className="dcard"><b>平台记忆</b><span>只发新问题，上下文由书童保存并自动压缩。</span></Link>
        <Link href="/docs/pricing" className="dcard"><b>计费说明</b><span>人民币计价、扣费方式与价格表。</span></Link>
      </div>
      <DocNext href="/docs" />
    </>
  );
}

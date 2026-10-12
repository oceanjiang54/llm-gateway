import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "平台记忆 · 书童文档" };

const KEEP = Number(process.env.MEMORY_KEEP_MESSAGES || 6);
const LIMIT = Number(process.env.MEMORY_COMPRESS_TOKENS || 8000);

export default function MemoryDoc() {
  const s = samples(siteBase());
  return (
    <>
      <h1>平台记忆</h1>
      <p className="lead">普通调用需要客户端每次把完整历史发给模型。开启平台记忆后，历史由书童在服务端保存，客户端只发本轮的新问题；对话变长时自动压缩，节省 tokens。</p>

      <h2>使用方法</h2>
      <ol>
        <li>第一轮请求加上 <code>{'"conversation_id": "new"'}</code>。</li>
        <li>从响应中取回会话 ID：非流式在响应体的 <code>conversation_id</code> 字段，流式在每个数据块里，同时也在响应头 <code>x-conversation-id</code> 中。</li>
        <li>之后的请求带上这个 ID，<code>messages</code> 只放本轮的新消息。</li>
      </ol>
      <Code tabs={[{ label: "Python", code: s.memoryPy }, { label: "Node.js", code: s.memoryNode }, { label: "cURL", code: s.memoryCurl }]} />

      <h2>工作方式</h2>
      <ul>
        <li><b>归属</b>：会话属于你的书童账号。同一账号下的不同 API Key 可以共用会话，其他账号无法读取。</li>
        <li><b>自动压缩</b>：当上一轮的输入超过 {LIMIT.toLocaleString()} tokens 时，书童会把较早的对话压缩成摘要，最近 {KEEP} 条消息保留原文。</li>
        <li><b>计费</b>：压缩本身调用一次低价模型，费用照常计入账单，在控制台记为 <code>memory</code>。</li>
      </ul>

      <h2>管理会话</h2>
      <table>
        <tbody>
          <tr><td><code>GET /api/v1/conversations</code></td><td>列出我的会话（最近 100 个）</td></tr>
          <tr><td><code>GET /api/v1/conversations/&lt;id&gt;</code></td><td>查看摘要与全部消息</td></tr>
          <tr><td><code>DELETE /api/v1/conversations/&lt;id&gt;</code></td><td>删除会话</td></tr>
        </tbody>
      </table>
      <Code label="cURL" code={s.convList} />
      <DocNext href="/docs/memory" />
    </>
  );
}

import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "流式输出 · 书童文档" };

const SSE = `data: {"id":"chatcmpl-…","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"你"}}]}

data: {"id":"chatcmpl-…","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"好"}}]}

data: {"id":"chatcmpl-…","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":14,"completion_tokens":28,"total_tokens":42}}

data: [DONE]`;

export default function StreamingDoc() {
  const s = samples(siteBase());
  return (
    <>
      <h1>流式输出</h1>
      <p className="lead">请求中加上 <code>{'"stream": true'}</code>，模型边生成边返回，用户能更快看到第一个字。适合聊天界面和长文本生成。</p>

      <h2>示例</h2>
      <Code tabs={[{ label: "cURL", code: s.streamCurl }, { label: "Python", code: s.streamPy }, { label: "Node.js", code: s.streamNode }]} />

      <h2>数据格式</h2>
      <p>响应为 Server-Sent Events，每行 <code>data: </code> 后是一个 JSON 数据块，最后以 <code>data: [DONE]</code> 结束。</p>
      <Code label="SSE" code={SSE} />
      <ul>
        <li>每个数据块的 <code>choices[0].delta.content</code> 是新生成的文字片段。</li>
        <li>用量 <code>usage</code> 在最后一个数据块中返回，这个数据块的 <code>choices</code> 可能为空数组，读取前请先判断。</li>
        <li>单次请求最长 300 秒，超长生成建议分段。</li>
      </ul>
      <DocNext href="/docs/streaming" />
    </>
  );
}

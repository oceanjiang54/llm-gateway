import Link from "next/link";
import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "对话补全 · 书童文档" };

const RESP = `{
  "id": "chatcmpl-3f9a1c2b7d4e",
  "object": "chat.completion",
  "created": 1760256000,
  "model": "deepseek-chat",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "你好！我是一个 AI 助手……" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 14, "completion_tokens": 28, "total_tokens": 42 }
}`;

export default function ChatDoc() {
  const base = siteBase();
  const s = samples(base);
  return (
    <>
      <h1>对话补全</h1>
      <p className="lead">所有模型共用一个端点，通过 <code>model</code> 参数切换。请求与响应格式与 OpenAI Chat Completions 一致，现有 SDK 直接可用。</p>
      <Code label="Endpoint" code={`POST ${base}/api/v1/chat/completions`} />

      <h2>请求参数</h2>
      <table>
        <thead><tr><th>参数</th><th style={{ width: 90 }}>类型</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td><code>model</code> 必填</td><td>string</td><td>模型 ID，如 <code>deepseek-chat</code>、<code>qwen-plus</code>、<code>claude-sonnet-4-5</code>。可用模型见 <Link href="/docs/models">模型列表</Link></td></tr>
          <tr><td><code>messages</code> 必填</td><td>array</td><td>对话消息，每条包含 <code>role</code>（<code>system</code> / <code>user</code> / <code>assistant</code>）和 <code>content</code>（文本）</td></tr>
          <tr><td><code>stream</code></td><td>boolean</td><td>是否流式返回，默认 <code>false</code>。见 <Link href="/docs/streaming">流式输出</Link></td></tr>
          <tr><td><code>temperature</code></td><td>number</td><td>采样温度，越高越发散。GPT-6 系列为推理模型，不支持此参数，网关会自动忽略</td></tr>
          <tr><td><code>max_tokens</code></td><td>integer</td><td>本次最多生成的 tokens 数。Claude 系列未填写时默认 1024；GPT 系列由网关自动转为 <code>max_completion_tokens</code></td></tr>
          <tr><td><code>conversation_id</code></td><td>string</td><td>书童扩展：开启平台记忆。见 <Link href="/docs/memory">平台记忆</Link></td></tr>
        </tbody>
      </table>
      <div className="callout">目前支持纯文本对话。<code>tools</code>、图片输入等参数暂不转发给上游，会被忽略。</div>

      <h2>示例</h2>
      <Code tabs={[{ label: "cURL", code: s.chatCurl }, { label: "Python", code: s.chatPy }, { label: "Node.js", code: s.chatNode }]} />
      <h3>带 system 提示与参数</h3>
      <Code label="Python" code={s.chatFullPy} />

      <h2>响应</h2>
      <Code label="JSON" code={RESP} />
      <table>
        <thead><tr><th>字段</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td><code>choices[0].message.content</code></td><td>模型的回答</td></tr>
          <tr><td><code>usage</code></td><td>本次消耗的 tokens，计费以此为准</td></tr>
          <tr><td><code>conversation_id</code></td><td>仅在开启平台记忆时返回</td></tr>
        </tbody>
      </table>
      <DocNext href="/docs/chat" />
    </>
  );
}

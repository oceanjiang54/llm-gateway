import DocNext from "@/components/docs/DocNext";
import Code from "@/components/docs/Code";

export const metadata = { title: "错误码 · 书童文档" };

const ERR = `{
  "error": {
    "message": "Insufficient balance",
    "type": "billing_error"
  }
}`;

export default function ErrorsDoc() {
  return (
    <>
      <h1>错误码</h1>
      <p className="lead">请求失败时返回对应的 HTTP 状态码，响应体中的 <code>error.message</code> 说明具体原因。</p>
      <Code label="JSON" code={ERR} />
      <table>
        <thead><tr><th style={{ width: 80 }}>状态码</th><th>含义</th><th>建议处理</th></tr></thead>
        <tbody>
          <tr><td><code>400</code></td><td>请求格式错误，如缺少 <code>model</code> 或 <code>messages</code></td><td>检查请求体</td></tr>
          <tr><td><code>401</code></td><td>API Key 无效或已停用</td><td>确认密钥完整且未被停用</td></tr>
          <tr><td><code>402</code></td><td>账户余额不足</td><td>充值后重试</td></tr>
          <tr><td><code>403</code></td><td>账户已被停用</td><td>联系管理员</td></tr>
          <tr><td><code>404</code></td><td>模型或会话不存在</td><td>核对 <code>model</code> 或 <code>conversation_id</code></td></tr>
          <tr><td><code>429</code></td><td>达到每日用量上限，或上游限流</td><td>次日恢复，或稍后重试</td></tr>
          <tr><td><code>502</code></td><td>上游模型服务异常</td><td>稍后重试一次，仍失败请换模型</td></tr>
          <tr><td><code>503</code></td><td>该模型暂不可用</td><td>换用其他模型，或稍后再试</td></tr>
        </tbody>
      </table>
      <p>调用失败不扣费。Claude Code 入口（<code>/api/anthropic</code>）的错误按 Anthropic 格式返回，状态码含义相同。</p>
      <DocNext href="/docs/errors" />
    </>
  );
}

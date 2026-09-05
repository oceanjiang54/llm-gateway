import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

// API 参考文档：模型列表与定价从数据库实时读取，示例使用当前部署域名
export default async function Docs({ searchParams }: { searchParams?: { model?: string } }) {
  const models = await db.select().from(schema.models).where(eq(schema.models.enabled, true));
  const model = searchParams?.model && models.some((m) => m.id === searchParams.model)
    ? searchParams.model : "deepseek-chat";
  const host = headers().get("host") || "你的域名";
  const proto = host.includes("localhost") || /^\d/.test(host) ? "http" : "https";
  const base = `${proto}://${host}`;

  const curl = `curl ${base}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-gw-你的密钥" \\
  -d '{
    "model": "${model}",
    "stream": true,
    "messages": [{"role": "user", "content": "你好，介绍一下你自己"}]
  }'`;
  const py = `from openai import OpenAI

client = OpenAI(
    base_url="${base}/api/v1",
    api_key="sk-gw-你的密钥",
)

resp = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "你好"}],
    stream=True,
)
for chunk in resp:
    print(chunk.choices[0].delta.content or "", end="")`;

  return (
    <div className="container">
      <h2 className="section-title">API 文档</h2>
      <p className="section-sub">OpenAI 兼容：任何 SDK 改一行 base_url 即可接入 · 想跟着一步步做？看「接入」页</p>

      <div className="card">
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>接口</h3>
        <p style={{ color: "var(--sub)", marginBottom: 12, fontSize: 13 }}>
          端点：<code>POST {base}/api/v1/chat/completions</code>。所有模型共用同一端点，通过 <code>model</code> 参数切换；
          <code>stream: true</code> 开启流式输出；按实际 Token 用量计费。
        </p>
        <pre>{curl}</pre>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>可用模型与定价（实时）</h3>
        <table>
          <thead><tr><th>模型 ID</th><th>名称</th><th>输入 $/1M tokens</th><th>输出 $/1M tokens</th></tr></thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td><code>{m.id}</code></td>
                <td>{m.displayName}</td>
                <td>${m.inputPerM.toFixed(2)}</td>
                <td>${m.outputPerM.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>Python（OpenAI SDK）</h3>
        <pre>{py}</pre>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>错误码</h3>
        <table>
          <tbody>
            <tr><td><code>401</code></td><td>API Key 无效或已停用</td></tr>
            <tr><td><code>402</code></td><td>账户余额不足</td></tr>
            <tr><td><code>403</code></td><td>账户已被停用，请联系管理员</td></tr>
            <tr><td><code>404</code></td><td>模型不存在（检查 model 参数拼写）</td></tr>
            <tr><td><code>429</code></td><td>已达每日用量上限</td></tr>
            <tr><td><code>502</code></td><td>上游模型服务异常，请稍后重试</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

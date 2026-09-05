// API 文档页：展示 OpenAI 兼容用法；支持 ?model= 参数联动首页模型卡片
export default function Docs({ searchParams }: { searchParams?: { model?: string } }) {
  const model = searchParams?.model || "deepseek-chat";
  const curl = `curl https://你的域名/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-gw-你的密钥" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "你好，介绍一下你自己"}]
  }'`;
  const py = `# 任何 OpenAI SDK 均可直接使用，只需修改 base_url
from openai import OpenAI

client = OpenAI(
    base_url="https://你的域名/api/v1",
    api_key="sk-gw-你的密钥",
)

resp = client.chat.completions.create(
    model="${model}",   # 换模型只改这一行
    messages=[{"role": "user", "content": "你好"}],
    stream=True,                  # 支持流式
)
for chunk in resp:
    print(chunk.choices[0].delta.content or "", end="")`;

  return (
    <div className="container">
      <h2 className="section-title">API 文档</h2>
      <p className="section-sub">OpenAI 兼容：任何 SDK 改一行 base_url 即可接入 · 当前示例模型：{model}</p>
      <div className="card">
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>统一接口</h3>
        <p style={{ color: "var(--sub)", marginBottom: 12, fontSize: 13 }}>
          所有模型共用同一个端点，通过 <code>model</code> 参数切换，支持流式（stream）输出，按实际 Token 用量计费。
        </p>
        <pre>{curl}</pre>
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
            <tr><td><code>404</code></td><td>模型不存在</td></tr>
            <tr><td><code>502</code></td><td>上游模型服务异常</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// 接入：面向专业用户的分步 runbook，从零到本地跑通 API 调用
export default function Guide() {
  const host = headers().get("host") || "你的域名";
  const proto = host.includes("localhost") || /^\d/.test(host) ? "http" : "https";
  const base = `${proto}://${host}`;

  const steps = [
    {
      t: "注册账号并创建密钥",
      body: <>在<Link href="/register" style={{ color: "var(--glow)" }}>注册页</Link>用邮箱或手机号注册（送 $5 试用额度），
        然后到 <Link href="/console/keys" style={{ color: "var(--glow)" }}>控制台 → API Keys</Link> 创建密钥。
        密钥形如 <code>sk-gw-...</code>，只显示一次，请立即保存到安全位置（如密码管理器或环境变量），不要提交到代码仓库。</>,
      code: `# 推荐：把密钥放进环境变量，避免硬编码\nexport SHUTONG_API_KEY="sk-gw-你的密钥"`,
    },
    {
      t: "用 curl 跑通第一次调用",
      body: <>验证密钥与网络连通性。任何能发 HTTP 请求的环境都可以：</>,
      code: `curl ${base}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SHUTONG_API_KEY" \\
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "你好"}]}'`,
    },
    {
      t: "接入你的代码（OpenAI SDK 兼容）",
      body: <>本平台完全兼容 OpenAI Chat Completions 格式——已有项目只需改 <code>base_url</code> 一行。Python：</>,
      code: `pip install openai

from openai import OpenAI
import os

client = OpenAI(
    base_url="${base}/api/v1",
    api_key=os.environ["SHUTONG_API_KEY"],
)
resp = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "总结这段文字…"}],
)
print(resp.choices[0].message.content)`,
    },
    {
      t: "Node.js 接入",
      body: <>同理，官方 openai 包直接可用：</>,
      code: `npm install openai

import OpenAI from "openai";
const client = new OpenAI({
  baseURL: "${base}/api/v1",
  apiKey: process.env.SHUTONG_API_KEY,
});
const resp = await client.chat.completions.create({
  model: "deepseek-chat",
  messages: [{ role: "user", content: "你好" }],
});
console.log(resp.choices[0].message.content);`,
    },
    {
      t: "开启流式输出（推荐）",
      body: <>加 <code>stream: true</code>，首字节 1 秒内返回，用户体验大幅提升；用量信息在最后一个数据块中返回：</>,
      code: `stream = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "写一段产品介绍"}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`,
    },
    {
      t: "处理错误与用量",
      body: <>关键错误码：<code>401</code> 密钥无效、<code>402</code> 余额不足、<code>429</code> 达到每日限额、<code>502</code> 上游异常（建议重试一次）。
        完整列表见<Link href="/docs" style={{ color: "var(--glow)" }}>文档</Link>。
        每次调用的 token 消耗与费用在<Link href="/console" style={{ color: "var(--glow)" }}>控制台</Link>实时可查——按部门核算成本就靠它。</>,
      code: null,
    },
  ];

  return (
    <div className="container">
      <h2 className="section-title">接入指南</h2>
      <p className="section-sub">给工程师的 runbook：六步，从零到把大模型接进你的系统。只想动嘴不想动手？去「体验」</p>
      {steps.map((s, i) => (
        <div className="card" key={i}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <span className="step-num">{i + 1}</span>
            <h3 style={{ fontSize: 15 }}>{s.t}</h3>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--sub)", lineHeight: 1.9, marginBottom: s.code ? 12 : 0 }}>{s.body}</p>
          {s.code && <pre>{s.code}</pre>}
        </div>
      ))}
    </div>
  );
}

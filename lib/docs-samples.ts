// 文档中心的全部示例代码集中在这里：页面渲染与自动化验证用同一份源码
// 约定：密钥一律从环境变量 SHUTONG_API_KEY 读取，复制后由用户自己填写
export function samples(base: string, model = "deepseek-chat") {
  const api = `${base}/api/v1`;
  return {
    envKey: `export SHUTONG_API_KEY="sk-gw-你的密钥"`,

    // ---- 检查 Key：列出可用模型 ----
    modelsCurl: `curl ${api}/models \\
  -H "Authorization: Bearer $SHUTONG_API_KEY"`,
    modelsPy: `import os
from openai import OpenAI

client = OpenAI(base_url="${api}", api_key=os.environ["SHUTONG_API_KEY"])
for m in client.models.list():
    print(m.id)`,
    modelsNode: `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${api}", apiKey: process.env.SHUTONG_API_KEY });
for await (const m of client.models.list()) console.log(m.id);`,

    // ---- 第一次请求 ----
    chatCurl: `curl ${api}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SHUTONG_API_KEY" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "你好，用一句话介绍你自己"}]
  }'`,
    chatPy: `import os
from openai import OpenAI

client = OpenAI(base_url="${api}", api_key=os.environ["SHUTONG_API_KEY"])
resp = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "你好，用一句话介绍你自己"}],
)
print(resp.choices[0].message.content)
print("用量:", resp.usage.total_tokens, "tokens")`,
    chatNode: `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${api}", apiKey: process.env.SHUTONG_API_KEY });
const resp = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "你好，用一句话介绍你自己" }],
});
console.log(resp.choices[0].message.content);
console.log("用量:", resp.usage.total_tokens, "tokens");`,

    // ---- 多轮 + system ----
    chatFullPy: `import os
from openai import OpenAI

client = OpenAI(base_url="${api}", api_key=os.environ["SHUTONG_API_KEY"])
resp = client.chat.completions.create(
    model="${model}",
    messages=[
        {"role": "system", "content": "你是一名简洁的商务写作助手。"},
        {"role": "user", "content": "帮我写一句会议邀请的开场白"},
    ],
    temperature=0.7,
    max_tokens=300,
)
print(resp.choices[0].message.content)`,

    // ---- 流式 ----
    streamCurl: `curl -N ${api}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SHUTONG_API_KEY" \\
  -d '{
    "model": "${model}",
    "stream": true,
    "messages": [{"role": "user", "content": "写一段 100 字的产品介绍"}]
  }'`,
    streamPy: `import os
from openai import OpenAI

client = OpenAI(base_url="${api}", api_key=os.environ["SHUTONG_API_KEY"])
stream = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "写一段 100 字的产品介绍"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
    if chunk.usage:
        print("\\n用量:", chunk.usage.total_tokens, "tokens")`,
    streamNode: `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${api}", apiKey: process.env.SHUTONG_API_KEY });
const stream = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "写一段 100 字的产品介绍" }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
  if (chunk.usage) console.log("\\n用量:", chunk.usage.total_tokens, "tokens");
}`,

    // ---- 平台记忆 ----
    memoryCurl: `# 第一轮：conversation_id 传 "new"，响应里会带回会话 ID
curl ${api}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SHUTONG_API_KEY" \\
  -d '{"model": "${model}", "conversation_id": "new",
       "messages": [{"role": "user", "content": "记住：我们的项目代号是“北极星”"}]}'

# 第二轮：带上上一步返回的 conversation_id，只发新问题
curl ${api}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SHUTONG_API_KEY" \\
  -d '{"model": "${model}", "conversation_id": "上一步返回的ID",
       "messages": [{"role": "user", "content": "项目代号是什么？"}]}'`,
    memoryPy: `import os
from openai import OpenAI

client = OpenAI(base_url="${api}", api_key=os.environ["SHUTONG_API_KEY"])

conv = "new"
for q in ["记住：我们的项目代号是“北极星”", "项目代号是什么？"]:
    r = client.chat.completions.create(
        model="${model}",
        messages=[{"role": "user", "content": q}],  # 只发本轮新问题
        extra_body={"conversation_id": conv},
    )
    conv = r.model_extra["conversation_id"]  # 第一轮之后拿到会话 ID
    print(r.choices[0].message.content)`,
    memoryNode: `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${api}", apiKey: process.env.SHUTONG_API_KEY });

let conv = "new";
for (const q of ["记住：我们的项目代号是“北极星”", "项目代号是什么？"]) {
  const r = await client.chat.completions.create({
    model: "${model}",
    messages: [{ role: "user", content: q }], // 只发本轮新问题
    conversation_id: conv,
  });
  conv = r.conversation_id; // 第一轮之后拿到会话 ID
  console.log(r.choices[0].message.content);
}`,
    convList: `# 列出我的会话
curl ${api}/conversations -H "Authorization: Bearer $SHUTONG_API_KEY"

# 查看某个会话的摘要与全部消息
curl ${api}/conversations/会话ID -H "Authorization: Bearer $SHUTONG_API_KEY"

# 删除会话
curl -X DELETE ${api}/conversations/会话ID -H "Authorization: Bearer $SHUTONG_API_KEY"`,

    // ---- 工具 ----
    claudeCode: `export ANTHROPIC_BASE_URL=${base}/api/anthropic
export ANTHROPIC_AUTH_TOKEN=sk-gw-你的密钥
claude`,
    claudeCodeDiscovery: `# 可选：让 /model 列出书童提供的 Claude 模型
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`,
    claudeCodeVscode: `// VS Code 用户设置（settings.json）
"claudeCode.environmentVariables": [
  { "name": "ANTHROPIC_BASE_URL", "value": "${base}/api/anthropic" },
  { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-gw-你的密钥" }
]`,
    claudeCodeCheck: `curl ${base}/api/anthropic/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $SHUTONG_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{"model": "claude-sonnet-4-5", "max_tokens": 64,
       "messages": [{"role": "user", "content": "你好"}]}'`,
    cliInstall: `# macOS / Linux（需要 Node 18 以上）
mkdir -p ~/.shutong ~/.local/bin
curl -fsSL ${base}/shutong.mjs -o ~/.shutong/shutong.mjs
chmod +x ~/.shutong/shutong.mjs
ln -sf ~/.shutong/shutong.mjs ~/.local/bin/shutong
export PATH="$HOME/.local/bin:$PATH"   # 建议同时写进 ~/.zshrc 或 ~/.bashrc

shutong login   # 填写服务地址 ${base} 和你的密钥`,
    cliUse: `shutong                                  # 交互对话
shutong "帮我写一条请假消息"                # 问一次就退出
cat error.log | shutong "这段报错是什么原因"  # 把管道内容一起发送
shutong -m qwen-plus "翻译成英文：……"       # 指定模型`,
  
    // ---- Codex ----
    codexInstall: `npm install -g @openai/codex
codex --version`,
    codexConfig: `mkdir -p ~/.codex

# 1. 定义书童这个模型服务商（追加到 ~/.codex/config.toml）
cat >> ~/.codex/config.toml <<'EOF'

[model_providers.shutong]
name = "书童 ShuTong"
base_url = "${base}/api/openai/v1"
env_key = "SHUTONG_API_KEY"
wire_api = "responses"
EOF

# 2. 书童配置档（独立文件，不影响默认的 codex）
cat > ~/.codex/shutong.config.toml <<'EOF'
model_provider = "shutong"
model = "gpt-5.3-codex"
EOF`,
    codexSt: `# 书童密钥（与 claude-st 共用同一个文件）
mkdir -p ~/.shutong
printf '%s' "sk-gw-你的密钥" > ~/.shutong/cc_token
chmod 600 ~/.shutong/cc_token

cat >> ~/.zshrc <<'EOF'

# Codex 经书童网关（普通的 codex 命令不受影响）
codex-st() {
  SHUTONG_API_KEY="$(cat ~/.shutong/cc_token)" codex --profile shutong "$@"
}
EOF
source ~/.zshrc`,
    codexUse: `codex-st                                 # 交互模式
codex-st exec "解释一下这个项目的目录结构"   # 一次性任务
codex-st -m gpt-6.1-sol                  # 临时换模型`,
    codexCheck: `curl ${base}/api/openai/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SHUTONG_API_KEY" \\
  -d '{"model": "gpt-6-luna", "input": "用五个字介绍你自己"}'`,
  };
}

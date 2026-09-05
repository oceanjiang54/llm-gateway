# 企业智能引擎 · LLM Gateway（原型 v3 · 可部署版）

OpenRouter 式统一大模型 API 网关：一个 OpenAI 兼容接口接入多个上游模型（Claude + DeepSeek），含邮箱/手机号验证码注册、API Key 管理、按 Token 计量的虚拟计费与用量看板。数据库为 Postgres（Supabase），本地与线上共用。

## 一、本地启动

```bash
cp .env.example .env    # 填入下方四个环境变量
npm install
npm run db:setup        # 建表 + 写入模型定价（只需运行一次）
npm run dev             # http://localhost:3000
```

.env 需要的变量：
- DATABASE_URL   Supabase 连接串（见部署第 2 步；本地开发也直接连 Supabase）
- AUTH_SECRET    随机长字符串（openssl rand -base64 32 生成）
- ANTHROPIC_API_KEY / DEEPSEEK_API_KEY   上游模型密钥
- RESEND_API_KEY（可选）配置后验证码走真实邮件；不配置则为开发模式（验证码直接显示在注册页面）

## 二、部署到 Vercel（约 20 分钟）

1. 代码上传 GitHub：github.com 新建私有仓库（如 llm-gateway），然后在项目目录执行：

   git init && git add -A && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的用户名/llm-gateway.git
   git push -u origin main

   .env 已在 .gitignore 中不会被上传——push 前用 git status 确认列表里没有 .env。

2. Supabase 建库：supabase.com 新建项目（区域选 Singapore）→ 项目首页点 Connect →
   复制 "Transaction pooler" 连接串（端口 6543），把其中 [YOUR-PASSWORD] 换成建项目时设的数据库密码。
   把连接串填进本地 .env 的 DATABASE_URL，然后本地运行一次 npm run db:setup 完成云端建表。

3. Vercel 部署：vercel.com → Add New Project → 选择你的 GitHub 仓库 →
   Environment Variables 里逐个添加：DATABASE_URL、AUTH_SECRET、ANTHROPIC_API_KEY、DEEPSEEK_API_KEY
   → Deploy。完成后获得 https://xxx.vercel.app 域名，注册/调用/计费全部在线可用。

4. 验证：打开线上域名注册账号 → 创建 Key → 用下方 curl（域名换成线上地址）调用。

注意事项：
- Vercel Hobby 版函数默认超时 10 秒（项目设置开启 Fluid Compute 可放宽）；长回复建议用流式（stream: true）
- 上游密钥只存在 Vercel 环境变量里；在 DeepSeek/Anthropic 后台设置用量上限以防滥用
- 正式对外运营前需完成生成式 AI 服务备案等合规手续（原型内部试用不受影响）

## 三、快速验证

```bash
curl https://你的域名/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-gw-你的密钥" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "你好"}]}'
```

## 四、架构

```
app/api/v1/chat/completions/route.ts   统一网关：鉴权 → 额度 → 路由 → 转发 → 计量扣费
lib/providers/                          适配器层（anthropic.ts / deepseek.ts）
lib/schema.ts + lib/db.ts               Drizzle + Postgres 数据层
lib/verify.ts                           验证码：签发 / 频控 / 防重放；邮件与短信渠道可插拔
scripts/setup-db.mjs                    一次性建表与定价初始化
```

## 五、尚未实现（规划中）

- 真实支付充值（当前为虚拟额度）
- 短信真实发送：需阿里云/腾讯云短信签名审批（需企业主体）后接入 lib/verify.ts 预留位
- 智能模型路由（model: "auto" 按任务难度自动选模型 —— pitch 核心卖点）
- 速率限制、管理后台

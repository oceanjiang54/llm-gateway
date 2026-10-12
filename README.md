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
- RESEND_API_KEY（可选）配置后验证码走真实邮件；不配置则为开发模式（验证码直接显示在注册页面）。配合 MAIL_FROM 使用，发件域名须先在 Resend 后台 Domains 验证；发送失败时页面提示重试，原因写在服务端日志 `[mail]` 行

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

## 六、v25 新增（2026-10）

**首页改版**：明亮企业风；七个板块（首屏双入口、模型市场、AI 基础设施、FDE 落地流程、Agent 演示、为什么选择我们、底部 CTA）。
新页面：`/models` 模型市场、`/models/<id>` 模型详情。企业留资弹窗 → 管理后台「企业线索」。

**新模型**：Qwen Max / Qwen Plus（阿里云百炼国际站）、Kimi K2.6（Moonshot 国际站）。
MiniMax / GPT / Gemini 在模型市场显示为「即将接入」。

**平台记忆**：请求带 `conversation_id`，网关保存上下文并按阈值压缩，见接入页「进阶用法」。

**命令行客户端**：`cli/` 目录，`npm link` 后终端输入 `shutong`。

**Claude Code 接入**：`ANTHROPIC_BASE_URL=https://<域名>/api/anthropic` + `ANTHROPIC_AUTH_TOKEN=sk-gw-...`，
按 Anthropic 官方价 ×1.3 计费（含缓存读写）。单次请求最长 300 秒（Vercel 免费版 Fluid compute 上限）。

新增环境变量（均可选）：

| 变量 | 说明 |
|---|---|
| `QWEN_API_KEY` | 阿里云百炼国际站密钥；不配则 Qwen 模型返回 503 |
| `KIMI_API_KEY` | Moonshot 国际站密钥；不配则 Kimi 返回 503 |
| `QWEN_BASE_URL` / `KIMI_BASE_URL` | 改用国内站时覆盖（见 lib/providers/index.ts 注释） |
| `MEMORY_COMPRESS_TOKENS` | 触发压缩的输入 token 阈值，默认 8000 |
| `MEMORY_KEEP_MESSAGES` | 压缩时保留的最近消息条数，默认 6 |
| `MEMORY_SUMMARY_MODEL` | 生成摘要用的模型，默认 deepseek-chat |

升级步骤：拉取代码后执行一次 `npm run db:setup`（新增模型元数据列、留资表、记忆表，幂等）。

## 七、v26 更新（2026-10）

**升级时必须执行一次 `npm run db:setup`**：把余额、限额、历史用量从美元换算为人民币（按 `USD_CNY_RATE`，可重复执行，不会重复换算），并新增按时间查询的索引。

| 变更 | 说明 |
|---|---|
| 人民币结算 | 所有价格、余额、扣费、后台统计改为人民币。模型售价 = 上游美元价 × 汇率 × 1.3 |
| 文档中心 | `/docs` 默认「三分钟上手」，左侧导航：对话补全、流式输出、模型列表、平台记忆、错误码、Claude Code、命令行、计费说明。旧 `/guide` 自动跳转 `/docs`。全部示例代码集中在 `lib/docs-samples.ts`，已用 openai Python / Node SDK 与 curl 逐条跑通 |
| 新接口 | `GET /api/v1/models`：OpenAI 兼容模型列表（含人民币价格、是否可用），可用来检查 Key |
| 命令行下载 | 构建时把 `cli/shutong.mjs` 复制到 `public/shutong.mjs`，用户按文档 `curl` 下载即可，无需代码库 |
| 上游报错 | 上游原始错误只写服务端日志；上游 401/403 对外返回 503「模型暂不可用」，429 透传为 429 |
| 管理后台 | 新增时间区间（今天/昨天/近 7 天/近 30 天/本月/自定义），默认当天，按北京时间统计；指标、趋势、模型分布、线索、用户消费均按区间 |
| 页脚 | 站点地图：产品 / 解决方案 / 开发者 / 关于 |

新增环境变量（均可不填）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `USD_CNY_RATE` | `7.0` | 固定汇率（2026-10-12 市场价约 6.69，向上取整留出余量） |
| `SIGNUP_BONUS_CNY` | `30` | 注册赠送额度（元） |
| `REPORT_TZ` | `Asia/Shanghai` | 管理后台按哪个时区划分「一天」 |

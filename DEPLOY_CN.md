# 国内访问部署指南（傻瓜版）

无需域名，两条路任选。合伙人只要能打开一个网址即可体验。

---

## 方案 A（推荐）：香港轻量云服务器，约 ¥30-60/月

国内访问稳定，Claude 和 DeepSeek 都能调通，7×24 在线。

1. **买服务器**：打开 腾讯云 lighthouse.cloud.tencent.com（或阿里云轻量）→
   地域选「香港」→ 镜像选 Ubuntu 22.04 → 最低配置即可（2核2G）→ 微信/支付宝付款。
2. **放行端口**：服务器详情页 → 防火墙 → 添加规则：TCP 端口 3000，来源 0.0.0.0/0。
3. **上传项目**：本地终端执行（IP 换成服务器公网 IP，密码在控制台设置）：
   ```bash
   scp -r ~/Documents/2026/OpenRouter/llm-gateway root@服务器IP:/root/
   ```
4. **登录并部署**：
   ```bash
   ssh root@服务器IP
   cd /root/llm-gateway
   cp .env.example .env && nano .env    # 填入四个变量（同你本地的 .env 内容）
   bash deploy-server.sh                 # 自动装 Docker + 构建 + 启动
   ```
5. 完成。把脚本最后输出的 `http://IP:3000` 发给合伙人即可。

日常运维：更新代码后 `docker compose up -d --build`；看日志 `docker compose logs -f`。

---

## 方案 B（零成本）：合伙人自己电脑跑

适合"先看一眼产品"。注意：大陆网络无法直连 Anthropic，
本机部署只能体验 DeepSeek 模型（Claude 卡片调用会报上游错误，属正常）。

合伙人需要做的：
1. 安装 Docker Desktop（docker.com 下载，国内可访问镜像站 docker.mirrors.ustc.edu.cn）。
2. 收到你发的项目压缩包（**内含你已配置好的 .env**——注意 .env 含密钥，请用网盘私发，不要进微信群）。
3. 解压后在文件夹里打开终端，执行一条命令：
   ```bash
   docker compose up -d --build
   ```
4. 浏览器打开 http://localhost:3000

> 给合伙人打包时用：`zip -r shutong-demo.zip llm-gateway -x "*/node_modules/*" "*/.next/*"`
> （这个包要包含 .env，与发给外人的包不同，注意区分）

---

## 常见问题

- **打不开 http://IP:3000** → 99% 是防火墙没放行 3000 端口，回到方案 A 第 2 步。
- **页面开了但调用报 upstream_error** → .env 里模型密钥没填对，改完后 `docker compose restart`。
- **Supabase 连不上** → 大陆访问新加坡 Supabase 偶有波动，重试即可；长期方案是数据库迁到香港/国内。

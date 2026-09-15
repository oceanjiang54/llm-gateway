# Claude 中继部署手册

## 为什么需要

Anthropic API 不对中国大陆及香港提供服务。当书童网关部署在国内服务器（长期方案）时，
Claude 请求需经境外中继转发；DeepSeek/通义等国产模型不受影响，继续直连。

```
用户 → 国内网关(鉴权/计费/路由) ──直连──→ 国产模型
                              └─HTTPS+令牌─→ 境外中继 → Anthropic
```

## 架构原则

- 同一代码库，按环境变量扮演角色：配 RELAY_TOKEN = 中继；配 ANTHROPIC_BASE_URL = 走中继；都不配 = 直连（当前默认）
- Anthropic 密钥只存在于中继侧，国内服务器不持有境外服务凭证
- 中继无状态：不落盘、不解析、流式原样回传，可随时销毁重建
- 合规开关：对「数据不出境」的租户，路由层只分配国产模型，请求物理上不经过中继

## 部署步骤

### 1. 中继侧（选一个境外节点）

推荐直接用现有 Vercel 部署（零成本），或新加坡轻量服务器。
在该部署的环境变量中添加：

```
RELAY_TOKEN=<openssl rand -hex 24 生成>
ANTHROPIC_API_KEY=<sk-ant-...>   # Vercel 上已有则无需重复
```

重新部署后，中继端点即为：https://<中继域名>/api/relay/anthropic/v1/messages

### 2. 调用侧（国内网关）

.env 添加两行，重启服务即可，业务代码零改动：

```
ANTHROPIC_BASE_URL="https://<中继域名>/api/relay/anthropic/v1"
ANTHROPIC_RELAY_TOKEN="<与中继侧相同>"
```

### 3. 验证

```bash
# 国内服务器上直接调用体验页或：
curl -sN https://<国内域名>/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-gw-你的密钥" \
  -d '{"model":"claude-sonnet-4-5","stream":true,"messages":[{"role":"user","content":"你好"}]}'
# 逐字流式返回即成功；延迟比直连增加约 0.3s（中继两跳）
```

## 安全清单

- [ ] RELAY_TOKEN 使用 32 位以上随机值，与部署密钥同级保管
- [ ] 中继侧未配置 RELAY_TOKEN 时端点返回 404（默认关闭）
- [ ] 令牌错误返回 401，不泄露中继存在性以外的信息
- [ ] 服务协议向客户披露：选用境外模型时请求内容将出境处理

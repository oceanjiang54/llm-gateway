#!/bin/bash
# 云服务器一键部署脚本（Ubuntu/Debian，腾讯云/阿里云轻量香港节点适用）
# 用法：把项目文件夹传到服务器后，在文件夹里执行  bash deploy-server.sh
set -e
echo "== 1/4 安装 Docker（已装会跳过）..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | bash
fi
echo "== 2/4 检查配置文件..."
if [ ! -f .env ]; then
  echo "!! 缺少 .env 文件：请先 cp .env.example .env 并填入 DATABASE_URL、AUTH_SECRET、模型密钥、ADMIN_ACCOUNTS"
  exit 1
fi
echo "== 3/4 构建并启动（首次约3-5分钟）..."
docker compose up -d --build
echo "== 4/4 完成！"
IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
echo "访问地址： http://$IP:3000"
echo "提示：如打不开，请在云服务器控制台的防火墙/安全组里放行 3000 端口（TCP）"

#!/bin/bash
# 兰控制台 一键启动脚本

echo "🚀 启动 LAN CLAUDE..."

cd "$(dirname "$0")"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  pnpm install
fi

# 启动
echo "🎯 启动服务..."
pnpm dev

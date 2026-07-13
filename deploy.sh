#!/bin/bash
# 部署脚本
set -e

echo "===== 知识库 RAG 系统部署 ====="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | bash
fi

# 检查 docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "安装 docker-compose..."
    pip install docker-compose
fi

# 复制环境变量
if [ ! -f .env ]; then
    cp .env.example .env
    echo "请编辑 .env 文件配置你的 DEEPSEEK_API_KEY"
    exit 1
fi

# 启动服务
echo "启动服务..."
docker-compose up -d

echo "===== 部署完成 ====="
echo "API 地址: http://localhost:8000"
echo "API 文档: http://localhost:8000/docs"

#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[错误] 未检测到 Python 3.11+，请先安装 Python。"
  exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "[1/5] 创建 Python 虚拟环境..."
  python3 -m venv .venv
fi

echo "[2/5] 检查后端依赖..."
.venv/bin/python -m pip install -r requirements.txt -q

if [ ! -f "frontend/dist/index.html" ]; then
  echo "[3/5] 构建网页前端..."
  (cd frontend && npm install && npm run build)
else
  echo "[3/5] 前端构建已存在，跳过构建。"
fi

echo "[4/5] 检查本地数据库..."
.venv/bin/python -m compileall -q backend

echo "[5/5] 启动服务：http://127.0.0.1:8765"
exec .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765

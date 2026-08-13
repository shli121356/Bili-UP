@echo off
chcp 65001 >nul
title 创作者洞察台
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  where python >nul 2>&1
  if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.11+。
    pause
    exit /b 1
  )
  echo [1/4] 创建 Python 虚拟环境...
  python -m venv .venv
)

echo [2/4] 检查后端依赖...
call .venv\Scripts\python.exe -m ensurepip --upgrade >nul 2>&1
call .venv\Scripts\python.exe -m pip install -r requirements.txt -q
if errorlevel 1 (
  echo [错误] 后端依赖安装失败，请检查网络或 requirements.txt。
  pause
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo [3/4] 构建网页前端...
  cd frontend
  call npm install
  call npm run build
  if errorlevel 1 (
    echo [错误] 前端构建失败，请检查 Node.js/npm。
    cd ..
    pause
    exit /b 1
  )
  cd ..
) else (
  echo [3/4] 前端构建已存在，跳过构建。
)

echo [4/4] 启动服务: http://127.0.0.1:8765
echo 关闭此窗口即可停止服务。
call .venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765

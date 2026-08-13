from __future__ import annotations

import importlib.util
import platform
import shutil
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter

from backend.config import BASE_DIR as PROJECT_ROOT

router = APIRouter()


def _check(label: str, value: str, ok: bool, detail: str = "") -> dict[str, str | bool]:
    return {"label": label, "value": value, "status": "ready" if ok else "warning", "detail": detail}


@router.get("/")
def environment_status() -> dict[str, object]:
    venv_python = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
    frontend_dist = PROJECT_ROOT / "frontend" / "dist"
    checks = [
        _check("Python 运行时", platform.python_version(), sys.version_info >= (3, 11)),
        _check("虚拟环境", ".venv · 可用", venv_python.exists(), str(venv_python)),
        _check("后端依赖", "FastAPI / SQLAlchemy / curl_cffi", all(importlib.util.find_spec(name) for name in ("fastapi", "sqlalchemy", "curl_cffi"))),
        _check("前端构建", "Vite · dist 已生成", frontend_dist.exists(), str(frontend_dist)),
        _check("Node.js", shutil.which("node") or "未找到", shutil.which("node") is not None),
        _check("B站会话", "本地会话文件已保存", (PROJECT_ROOT / "data" / "bilibili_session.json").exists()),
    ]
    return {"status": "ready" if all(item["status"] == "ready" for item in checks) else "warning", "checks": checks}


@router.post("/frontend/build")
def frontend_build() -> dict[str, object]:
    npm = shutil.which("npm")
    if not npm:
        return {"status": "failed", "message": "未找到 npm"}
    result = subprocess.run([npm, "run", "build"], cwd=PROJECT_ROOT / "frontend", capture_output=True, text=True, timeout=180)
    return {"status": "completed" if result.returncode == 0 else "failed", "message": (result.stdout + result.stderr)[-3000:]}

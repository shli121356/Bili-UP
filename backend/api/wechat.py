from __future__ import annotations

import os
import subprocess
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

# Keep this explicit and local: the adapter must never search for or launch an
# arbitrary executable supplied by a webpage.
WECHAT_PATH = Path(os.environ.get("CREATOR_MANAGER_WECHAT_PATH", r"E:\微信\Weixin\Weixin.exe"))


def _is_running() -> bool:
    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq Weixin.exe", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        return "Weixin.exe" in result.stdout
    except (OSError, subprocess.SubprocessError):
        return False


@router.get("/status")
def status() -> dict:
    running = _is_running()
    return {
        "running": running,
        "logged_in": None,
        "message": "已检测到微信客户端；登录状态请在微信可见界面确认。" if running else "未检测到微信客户端。",
        "adapter": "desktop-ui-skeleton",
        "scope": "仅支持用户明确授权的公众号公开名称、文章和公开互动字段",
    }


@router.post("/launch")
def launch() -> dict:
    if _is_running():
        return {**status(), "launched": False, "message": "微信已经在运行。请在微信界面确认已登录。"}
    if not WECHAT_PATH.exists():
        return {
            "running": False,
            "logged_in": None,
            "launched": False,
            "message": f"找不到微信程序：{WECHAT_PATH}",
            "adapter": "desktop-ui-skeleton",
        }
    try:
        subprocess.Popen([str(WECHAT_PATH)], cwd=str(WECHAT_PATH.parent))
    except OSError as exc:
        return {"running": False, "logged_in": None, "launched": False, "message": f"微信启动失败：{exc}"}
    return {**status(), "launched": True, "message": "微信启动请求已发送，请在微信界面完成登录或确认公众号页面。"}


@router.post("/capture")
def capture() -> dict:
    """Expose the P2 adapter boundary without pretending to have captured data.

    The real collector will be added behind this contract after a visible,
    user-authorized public-account flow is available. Chat records, contacts,
    credentials, and private profile data are intentionally out of scope.
    """
    current = status()
    if not current["running"]:
        return {**current, "status": "wechat_not_running", "creator_count": 0, "content_count": 0}
    return {
        **current,
        "status": "needs_user_action",
        "creator_count": 0,
        "content_count": 0,
        "message": "已连接微信客户端。请先在微信中打开目标公众号的公开文章列表，再开始下一步采集；当前适配器不会读取聊天记录或私密信息。",
        "pipeline": ["启动/检测", "采集（待用户确认公开页面）", "清洗", "去重", "入库", "分析"],
    }

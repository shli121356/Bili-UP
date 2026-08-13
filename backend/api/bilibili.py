from __future__ import annotations

import base64
import json
import random
import re
import threading
import time
from uuid import uuid4
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

import qrcode
from qrcode.image.svg import SvgPathImage
from curl_cffi import requests as curl_requests
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.analysis import analyze_all
from backend.api.settings import read_settings
from backend.config import DATA_DIR
from backend.database import SessionLocal, get_db
from backend.models import Content, Creator, SyncTask, now_utc
from backend.models import AnalysisSetting

router = APIRouter()

_BILI_HOME = "https://www.bilibili.com/"
_PASSPORT = "https://passport.bilibili.com"
_API = "https://api.bilibili.com"
_session = curl_requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
    "Referer": _BILI_HOME,
    "Accept": "application/json, text/plain, */*",
})
_SESSION_FILE = DATA_DIR / "bilibili_session.json"
_qr_lock = threading.Lock()
_qr_state: dict[str, Any] = {"key": None, "url": None, "image": None, "status": "idle", "message": "尚未开始扫码登录", "created_at": None}
_sync_lock = threading.Lock()
_sync_stop = threading.Event()
_sync_state: dict[str, Any] = {
    "job_id": None,
    "status": "idle",
    "phase": "idle",
    "message": "尚未开始自动读取",
    "following_total": 0,
    "followings_processed": 0,
    "videos_scanned": 0,
    "new_content": 0,
    "new_creators": 0,
    "total_creator_count": 0,
    "total_content_count": 0,
    "started_at": None,
    "finished_at": None,
}
_metrics_lock = threading.Lock()
_metrics_state: dict[str, Any] = {"status": "idle", "processed": 0, "total": 0, "updated": 0, "message": "尚未补齐视频互动数据"}


def _load_session() -> None:
    try:
        if _SESSION_FILE.exists():
            saved = json.loads(_SESSION_FILE.read_text(encoding="utf-8"))
            if isinstance(saved, dict):
                _session.cookies.update(saved)
    except (OSError, json.JSONDecodeError):
        return


def _save_session() -> None:
    try:
        _SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SESSION_FILE.write_text(json.dumps(_session.cookies.get_dict(), ensure_ascii=False), encoding="utf-8")
    except OSError:
        return


_load_session()


def _json_get(url: str, **kwargs: Any) -> dict[str, Any]:
    response = _session.get(url, timeout=15, impersonate="chrome120", **kwargs)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("B站返回格式异常")
    return payload


def _qr_image(data: str) -> str:
    qr = qrcode.QRCode(version=None, box_size=8, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    svg = qr.make_image(image_factory=SvgPathImage).to_string()
    if isinstance(svg, str):
        svg = svg.encode("utf-8")
    return "data:image/svg+xml;base64," + base64.b64encode(svg).decode("ascii")


def _new_qr() -> dict[str, Any]:
    payload = _json_get(f"{_PASSPORT}/x/passport-login/web/qrcode/generate")
    data = payload.get("data") or {}
    url = data.get("url")
    key = data.get("qrcode_key")
    if not url or not key:
        raise ValueError(payload.get("message") or "B站二维码生成失败")
    with _qr_lock:
        _qr_state.update({"key": key, "url": url, "image": _qr_image(url), "status": "waiting", "message": "请使用哔哩哔哩 App 扫描二维码", "created_at": time.time()})
        return dict(_qr_state)


def _logged_user() -> dict[str, Any] | None:
    try:
        payload = _json_get(f"{_API}/x/web-interface/nav")
        data = payload.get("data") or {}
        if data.get("isLogin"):
            return {"uid": str(data.get("mid")), "name": data.get("uname") or "B站用户"}
    except Exception:
        return None
    return None


def _fetch_followings_page(user_id: str, page: int, page_size: int = 50) -> tuple[list[dict[str, Any]], int | None]:
    payload = _json_get(f"{_API}/x/relation/followings", params={"vmid": user_id, "pn": page, "ps": page_size, "order": "desc", "order_type": "attention"})
    data = payload.get("data") or {}
    rows: list[dict[str, Any]] = []
    for item in data.get("list") or []:
        if isinstance(item, dict) and item.get("mid"):
            rows.append(item)
    total = data.get("total")
    return rows, int(total) if total is not None else None


def _fetch_all_followings(user_id: str) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    page = 1
    page_size = 50
    total: int | None = None
    while page <= 200:
        page_rows, reported_total = _fetch_followings_page(user_id, page, page_size)
        total = reported_total or total
        if not page_rows:
            break
        rows.extend(page_rows)
        if len(page_rows) < page_size or (total is not None and len(rows) >= total):
            break
        page += 1
        time.sleep(0.25)
    return rows, total or len(rows)


def _fetch_videos(uid: str, limit: int) -> list[dict[str, Any]]:
    payload = _json_get(f"{_API}/x/space/arc/search", params={"mid": uid, "pn": 1, "ps": min(max(limit, 1), 20), "order": "pubdate", "jsonp": "jsonp"})
    data = payload.get("data") or {}
    vlist = (data.get("list") or {}).get("vlist") or []
    videos: list[dict[str, Any]] = []
    for video in vlist[:limit]:
        if not isinstance(video, dict) or not video.get("title"):
            continue
        bvid = video.get("bvid")
        aid = video.get("aid")
        stats: dict[str, Any] = {}
        if bvid or aid:
            try:
                stats = _fetch_video_stats(f"https://www.bilibili.com/video/{bvid}" if bvid else f"https://www.bilibili.com/video/av{aid}") or {}
            except Exception:
                stats = {}
        videos.append({
            "title": video.get("title"),
            "url": f"https://www.bilibili.com/video/{bvid}" if bvid else f"https://www.bilibili.com/video/av{aid}",
            "published_at": datetime.fromtimestamp(int(video["created"]), tz=timezone.utc).isoformat() if video.get("created") else None,
            "view_count": stats.get("view_count", video.get("play")),
            "like_count": stats.get("like_count", video.get("like")),
            "comment_count": stats.get("comment_count", video.get("comment")),
            "share_count": stats.get("share_count", video.get("share")),
            "summary": video.get("description"),
            "duration": video.get("length"),
        })
    return videos


def _video_key(url: str | None) -> tuple[str, str] | None:
    match = re.search(r"/video/(BV[0-9A-Za-z]+)", url or "")
    if match:
        return "bvid", match.group(1)
    match = re.search(r"/video/av(\d+)", url or "")
    if match:
        return "aid", match.group(1)
    return None


def _fetch_video_stats(url: str | None) -> dict[str, int] | None:
    key = _video_key(url)
    if not key:
        return None
    payload = _json_get(f"{_API}/x/web-interface/view", params={key[0]: key[1]})
    stat = (payload.get("data") or {}).get("stat") or {}
    values = {field: stat.get(source) for field, source in (("view_count", "view"), ("like_count", "like"), ("comment_count", "reply"), ("share_count", "share"))}
    return {field: int(value) for field, value in values.items() if value is not None}


def _backfill_metrics_worker(limit: int) -> None:
    db = SessionLocal()
    try:
        rows = list(db.scalars(select(Content).join(Creator).where(Creator.platform == "bilibili").order_by(Content.published_at.desc())).all())
        targets = [row for row in rows if row.url and (row.like_count is None or row.view_count is None or row.comment_count is None or row.share_count is None)][:limit]
        with _metrics_lock:
            _metrics_state.update({"status": "running", "processed": 0, "total": len(targets), "updated": 0, "message": f"正在补齐 {len(targets)} 条视频互动数据"})
        updated = 0
        for index, content in enumerate(targets, start=1):
            try:
                stats = _fetch_video_stats(content.url)
                if stats:
                    changed = False
                    for field, value in stats.items():
                        if getattr(content, field) is None:
                            setattr(content, field, value)
                            changed = True
                    if changed:
                        updated += 1
                if index % 25 == 0:
                    db.commit()
                time.sleep(0.08)
            except Exception:
                db.rollback()
            with _metrics_lock:
                _metrics_state.update({"processed": index, "updated": updated, "message": f"已处理 {index}/{len(targets)} 条视频"})
        db.commit()
        with _metrics_lock:
            _metrics_state.update({"status": "completed", "processed": len(targets), "updated": updated, "message": f"互动数据补齐完成，更新 {updated} 条视频"})
        settings = read_settings(db)
        analyze_all(db, window_days=settings.window_days, sample_size=settings.sample_size, weights=settings.weights, platform="bilibili")
    except Exception as exc:
        db.rollback()
        with _metrics_lock:
            _metrics_state.update({"status": "failed", "message": f"互动数据补齐失败：{exc}"})
    finally:
        db.close()


@router.get("/metrics/status")
def metrics_status() -> dict[str, Any]:
    with _metrics_lock:
        return dict(_metrics_state)


@router.post("/metrics/backfill")
def backfill_metrics(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    with _metrics_lock:
        if _metrics_state["status"] == "running":
            return dict(_metrics_state)
        limit = min(max(int((payload or {}).get("limit", 2000)), 1), 5000)
        _metrics_state.update({"status": "starting", "processed": 0, "total": 0, "updated": 0, "message": "正在启动互动数据补齐"})
    threading.Thread(target=_backfill_metrics_worker, args=(limit,), daemon=True).start()
    return metrics_status()


def _fetch_follower_count(uid: str) -> int | None:
    try:
        data = _json_get(f"{_API}/x/relation/stat", params={"vmid": uid}).get("data") or {}
        return int(data["follower"]) if data.get("follower") is not None else None
    except Exception:
        return None


def _capture_items(db: Session, items: list[dict[str, Any]]) -> dict[str, Any]:
    creator_map: dict[str, Creator] = {}
    content_count = 0
    skipped = 0
    for item in items:
        if not isinstance(item, dict):
            skipped += 1
            continue
        name = str(item.get("creator_name") or item.get("author") or "").strip()
        title = str(item.get("title") or "").strip()
        if not name or not title:
            skipped += 1
            continue
        uid = str(item.get("creator_uid") or item.get("uid") or "").strip()
        key_name = f"{uid}:{name}" if uid else name
        creator = creator_map.get(key_name)
        if not creator and uid:
            creator = db.scalar(select(Creator).where(Creator.platform == "bilibili", Creator.platform_uid == uid))
        if not creator:
            creator = Creator(name=name, platform="bilibili", platform_uid=uid or None, description=f"B站 UP 主{f' · UID {uid}' if uid else ''}", last_sync_at=now_utc())
            db.add(creator)
            db.flush()
        elif uid and not creator.platform_uid:
            creator.platform_uid = uid
        if uid:
            creator.is_followed = True
        if item.get("avatar_url"):
            creator.avatar_url = str(item["avatar_url"])
        if item.get("follower_count") is not None:
            creator.follower_count = _integer(item["follower_count"])
        creator_map[key_name] = creator
        url = str(item.get("url") or "").strip() or None
        existing = db.scalar(select(Content).where(Content.creator_id == creator.id, Content.url == url)) if url else None
        if not existing:
            existing = db.scalar(select(Content).where(Content.creator_id == creator.id, Content.title == title))
        if existing:
            for field in ("view_count", "like_count", "share_count", "comment_count"):
                incoming = _integer(item.get(field))
                if getattr(existing, field) is None and incoming is not None:
                    setattr(existing, field, incoming)
            skipped += 1
            creator.last_sync_at = now_utc()
            continue
        published = _datetime(item.get("published_at") or item.get("pubdate"))
        content = Content(
            creator_id=creator.id,
            title=title,
            summary=item.get("summary") or item.get("description"),
            url=url,
            published_at=published,
            view_count=_integer(item.get("view_count") or item.get("views")),
            like_count=_integer(item.get("like_count") or item.get("likes")),
            share_count=_integer(item.get("share_count") or item.get("shares")),
            comment_count=_integer(item.get("comment_count") or item.get("comments")),
        )
        db.add(content)
        creator.article_count += 1
        # SQLite may return DateTime values without tzinfo even though the
        # model is timezone-aware. Normalize both sides before comparing.
        last_published = _aware_datetime(creator.last_published_at)
        if published and (last_published is None or published > last_published):
            creator.last_published_at = published
        creator.last_sync_at = now_utc()
        content_count += 1
    db.commit()
    settings = read_settings(db)
    analysis = analyze_all(db, window_days=settings.window_days, sample_size=settings.sample_size, weights=settings.weights, platform="bilibili")
    total_creators = db.query(Creator).filter(Creator.platform == "bilibili", Creator.is_followed.is_(True)).count()
    total_contents = db.query(Content).join(Creator).filter(Creator.platform == "bilibili", Creator.is_followed.is_(True)).count()
    return {"creator_count": len(creator_map) or total_creators, "content_count": content_count, "total_creator_count": total_creators, "total_content_count": total_contents, "skipped": skipped, "analysis": analysis}


def _ensure_followings(db: Session, followings: list[dict[str, Any]]) -> int:
    """Persist every followed UP before video scraping starts."""
    db.query(Creator).filter(Creator.platform == "bilibili").update({Creator.is_followed: False}, synchronize_session=False)
    ensured = 0
    for item in followings:
        uid = str(item.get("mid") or "").strip()
        name = str(item.get("uname") or "").strip()
        if not uid or not name:
            continue
        creator = db.scalar(select(Creator).where(Creator.platform == "bilibili", Creator.platform_uid == uid))
        if not creator:
            creator = Creator(
                name=name,
                platform="bilibili",
                platform_uid=uid,
                is_followed=True,
                description=f"B站 UP 主 · UID {uid}",
                status="观察中",
                last_sync_at=now_utc(),
            )
            db.add(creator)
        else:
            creator.platform_uid = uid
            creator.is_followed = True
            creator.last_sync_at = now_utc()
            if not creator.description:
                creator.description = f"B站 UP 主 · UID {uid}"
        creator.avatar_url = str(item.get("face") or creator.avatar_url or "") or None
        creator.follower_count = _fetch_follower_count(uid) or creator.follower_count
        ensured += 1
    db.commit()
    return ensured


def reconcile_bilibili_creators(db: Session) -> dict[str, int]:
    """Merge legacy name-only rows into the current UID rows without losing content."""
    rows = list(db.scalars(select(Creator).where(Creator.platform == "bilibili")).all())
    current = {row.name: row for row in rows if row.is_followed and row.platform_uid}
    merged = 0
    moved_contents = 0
    for legacy in rows:
        if legacy.platform_uid:
            continue
        target = current.get(legacy.name)
        if not target or target.id == legacy.id:
            continue
        existing_keys = {(item.url or "", item.title) for item in target.contents}
        for content in list(legacy.contents):
            key = (content.url or "", content.title)
            if key in existing_keys:
                db.delete(content)
                continue
            content.creator_id = target.id
            existing_keys.add(key)
            moved_contents += 1
        if not target.category_override and legacy.category_override:
            target.category_override = legacy.category_override
        if not target.status_override and legacy.status_override:
            target.status_override = legacy.status_override
        if not target.manual_notes and legacy.manual_notes:
            target.manual_notes = legacy.manual_notes
        if target.custom_tags in (None, "", "[]") and legacy.custom_tags not in (None, "", "[]"):
            target.custom_tags = legacy.custom_tags
        # Keep the legacy row for recovery/audit; it is excluded from the
        # current B站 overview because it is no longer marked as followed.
        legacy.is_followed = False
        merged += 1
    db.commit()
    current_followed = db.query(Creator).filter(Creator.platform == "bilibili", Creator.is_followed.is_(True)).count()
    return {"merged_creators": merged, "moved_contents": moved_contents, "current_followed": current_followed}


def _set_sync_state(**updates: Any) -> None:
    with _sync_lock:
        _sync_state.update(updates)
    if updates.get("status") in {"completed", "failed", "stopped"}:
        _persist_sync_state()


def _sync_snapshot() -> dict[str, Any]:
    with _sync_lock:
        return dict(_sync_state)


def _persist_sync_state() -> None:
    snapshot = _sync_snapshot()
    if not snapshot.get("job_id"):
        return
    db = SessionLocal()
    try:
        task = db.get(SyncTask, snapshot["job_id"])
        if not task:
            return
        for field in ("status", "phase", "message", "following_total", "followings_processed", "videos_scanned", "new_content", "new_creators", "total_creator_count", "total_content_count"):
            setattr(task, field, snapshot[field])
        if snapshot.get("finished_at"):
            task.finished_at = datetime.fromtimestamp(snapshot["finished_at"], tz=timezone.utc)
        db.commit()
    finally:
        db.close()


def _run_full_sync(job_id: str, videos_per_creator: int, delay_min: float, delay_max: float) -> None:
    db = SessionLocal()
    try:
        user = _logged_user()
        if not user:
            _set_sync_state(status="failed", phase="login_required", message="B站登录已失效，请重新扫码登录", finished_at=time.time())
            return
        _set_sync_state(status="running", phase="following_list", message="正在读取全部关注 UP 主")
        followings, total = _fetch_all_followings(user["uid"])
        existing_uids = {value for value in db.scalars(select(Creator.platform_uid).where(Creator.platform == "bilibili", Creator.platform_uid.is_not(None))).all()}
        new_creators = sum(1 for item in followings if str(item.get("mid") or "") not in existing_uids)
        ensured = _ensure_followings(db, followings)
        _set_sync_state(following_total=total, new_creators=new_creators, total_creator_count=db.query(Creator).filter(Creator.platform == "bilibili", Creator.is_followed.is_(True)).count(), total_content_count=db.query(Content).join(Creator).filter(Creator.platform == "bilibili", Creator.is_followed.is_(True)).count(), message=f"已找到 {total} 位关注 UP 主，已先入库 {ensured} 位账号")
        items: list[dict[str, Any]] = []
        for index, creator in enumerate(followings, start=1):
            if _sync_stop.is_set():
                _set_sync_state(status="stopped", phase="stopped", message="同步已由用户停止", finished_at=time.time())
                return
            uid = str(creator.get("mid"))
            name = str(creator.get("uname") or "").strip()
            _set_sync_state(phase="videos", followings_processed=index, message=f"正在读取第 {index}/{total} 位：{name}")
            try:
                videos = _fetch_videos(uid, videos_per_creator)
            except Exception:
                videos = []
            _set_sync_state(videos_scanned=_sync_snapshot()["videos_scanned"] + len(videos))
            items.extend({"creator_name": name, "creator_uid": uid, "avatar_url": creator.get("face"), **video} for video in videos)
            if index % 10 == 0:
                try:
                    result = _capture_items(db, items)
                except Exception as exc:
                    db.rollback()
                    _set_sync_state(message=f"第 {index} 位 UP 主入库异常，已跳过并继续：{exc}")
                else:
                    _set_sync_state(new_content=_sync_snapshot()["new_content"] + result["content_count"], total_creator_count=result["total_creator_count"], total_content_count=result["total_content_count"])
                finally:
                    items.clear()
            time.sleep(random.uniform(delay_min, delay_max))
        if items:
            try:
                result = _capture_items(db, items)
            except Exception as exc:
                db.rollback()
                _set_sync_state(message=f"末批内容入库异常，已保留已完成数据：{exc}")
            else:
                _set_sync_state(new_content=_sync_snapshot()["new_content"] + result["content_count"], total_creator_count=result["total_creator_count"], total_content_count=result["total_content_count"])
        merge_result = reconcile_bilibili_creators(db)
        settings = read_settings(db)
        _set_sync_state(phase="analysis", message="正在运行主题、热度与活跃度分析")
        analyze_all(db, window_days=settings.window_days, sample_size=settings.sample_size, weights=settings.weights, platform="bilibili")
        final = _sync_snapshot()
        _set_sync_state(status="completed", phase="completed", total_creator_count=merge_result["current_followed"], message=f"全量读取完成：{merge_result['current_followed']} 位 UP 主、{final['videos_scanned']} 条公开视频，已合并 {merge_result['merged_creators']} 条历史重复账号", finished_at=time.time())
    except Exception as exc:
        _set_sync_state(status="failed", phase="error", message=f"全量读取失败：{exc}", finished_at=time.time())
    finally:
        db.close()


@router.get("/sync/status")
def sync_status() -> dict[str, Any]:
    snapshot = _sync_snapshot()
    if snapshot.get("status") == "idle":
        db = SessionLocal()
        try:
            latest = db.query(SyncTask).filter(SyncTask.platform == "bilibili").order_by(SyncTask.created_at.desc()).first()
            if latest and latest.status in {"completed", "failed", "stopped"}:
                snapshot.update({
                    "job_id": latest.id,
                    "status": latest.status,
                    "phase": latest.phase,
                    "message": latest.message,
                    "following_total": latest.following_total,
                    "followings_processed": latest.followings_processed,
                    "videos_scanned": latest.videos_scanned,
                    "new_content": latest.new_content,
                    "new_creators": latest.new_creators,
                    "total_creator_count": latest.total_creator_count,
                    "total_content_count": latest.total_content_count,
                    "started_at": latest.started_at.timestamp() if latest.started_at else None,
                    "finished_at": latest.finished_at.timestamp() if latest.finished_at else None,
                })
        finally:
            db.close()
    return snapshot


@router.get("/avatar/{platform_uid}")
def creator_avatar(platform_uid: str) -> Response:
    """Proxy B站头像 through the local service to avoid browser hotlink blocking."""
    db = SessionLocal()
    try:
        creator = db.scalar(select(Creator).where(Creator.platform == "bilibili", Creator.platform_uid == platform_uid))
        avatar_url = creator.avatar_url if creator else None
    finally:
        db.close()
    if not avatar_url:
        raise HTTPException(status_code=404, detail="avatar not found")
    try:
        response = _session.get(avatar_url, timeout=15, impersonate="chrome120", headers={
            "Referer": _BILI_HOME,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        })
        response.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"B站头像读取失败：{exc}") from exc
    content_type = response.headers.get("content-type", "image/jpeg").split(";", 1)[0]
    return Response(content=response.content, media_type=content_type, headers={
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
    })


@router.post("/sync/start")
def start_full_sync(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    with _sync_lock:
        if _sync_state["status"] == "running":
            return dict(_sync_state)
        job_id = str(uuid4())
        _sync_state.update({"job_id": job_id, "status": "running", "phase": "starting", "message": "正在启动全量读取", "following_total": 0, "followings_processed": 0, "videos_scanned": 0, "new_content": 0, "new_creators": 0, "total_creator_count": 0, "total_content_count": 0, "started_at": time.time(), "finished_at": None})
    _sync_stop.clear()
    db = SessionLocal()
    try:
        db.add(SyncTask(id=job_id, platform="bilibili", status="running", phase="starting", message="正在启动全量读取"))
        db.commit()
    finally:
        db.close()
    settings_db = SessionLocal()
    try:
        settings = read_settings(settings_db)
    finally:
        settings_db.close()
    options = payload or {}
    videos_per_creator = min(max(int(options.get("videos_per_creator", max(5, settings.videos_per_creator))), 5), 20)
    delay_min = max(0.05, min(float(options.get("delay_min", settings.delay_min)), 30))
    delay_max = max(delay_min, min(float(options.get("delay_max", settings.delay_max)), 60))
    threading.Thread(target=_run_full_sync, args=(job_id, videos_per_creator, delay_min, delay_max), daemon=True).start()
    return _sync_snapshot()


@router.post("/sync/stop")
def stop_sync() -> dict[str, Any]:
    if _sync_snapshot()["status"] != "running":
        return _sync_snapshot()
    _sync_stop.set()
    _set_sync_state(message="正在停止同步，请等待当前请求结束")
    return _sync_snapshot()


@router.get("/sync/history")
def sync_history(limit: int = 20) -> dict[str, Any]:
    db = SessionLocal()
    try:
        rows = db.query(SyncTask).filter(SyncTask.platform == "bilibili").order_by(SyncTask.created_at.desc()).limit(max(1, min(limit, 100))).all()
        return {"items": [{"id": row.id, "platform": row.platform, "status": row.status, "phase": row.phase, "message": row.message, "following_total": row.following_total, "followings_processed": row.followings_processed, "videos_scanned": row.videos_scanned, "new_content": row.new_content, "new_creators": row.new_creators, "started_at": row.started_at, "finished_at": row.finished_at} for row in rows]}
    finally:
        db.close()


@router.post("/login/qr")
def create_login_qr() -> dict[str, Any]:
    try:
        state = _new_qr()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"无法生成 B站登录二维码：{exc}") from exc
    return {"status": state["status"], "message": state["message"], "qr_image": state["image"], "expires_in": 180}


@router.get("/login/status")
def login_status() -> dict[str, Any]:
    user = _logged_user()
    if user:
        _save_session()
        with _qr_lock:
            _qr_state.update({"status": "logged_in", "message": f"已登录：{user['name']}", "user": user})
        return {"status": "logged_in", "message": f"已登录：{user['name']}", "user": user}
    with _qr_lock:
        state = dict(_qr_state)
    if state.get("status") == "waiting" and state.get("key"):
        try:
            payload = _json_get(f"{_PASSPORT}/x/passport-login/web/qrcode/poll", params={"qrcode_key": state["key"]})
            code = (payload.get("data") or {}).get("code")
            if code == 0:
                user = _logged_user()
                if user:
                    _save_session()
                    return {"status": "logged_in", "message": f"已登录：{user['name']}", "user": user}
            elif code == 86090:
                with _qr_lock:
                    _qr_state.update({"status": "scanned", "message": "二维码已扫描，请在哔哩哔哩 App 确认登录"})
            elif code == 86038:
                with _qr_lock:
                    _qr_state.update({"status": "expired", "message": "二维码已过期，请重新生成"})
            with _qr_lock:
                current = dict(_qr_state)
            return {"status": current["status"], "message": current["message"], "qr_image": current.get("image"), "expires_in": 180}
        except Exception:
            pass
    return {"status": state.get("status", "idle"), "message": state.get("message", "尚未开始扫码登录"), "qr_image": state.get("image"), "expires_in": 180}


@router.post("/login/logout")
def logout() -> dict[str, str]:
    _session.cookies.clear()
    try:
        _SESSION_FILE.unlink(missing_ok=True)
    except OSError:
        pass
    with _qr_lock:
        _qr_state.update({"key": None, "url": None, "image": None, "status": "idle", "message": "已退出本地 B站会话"})
    return {"status": "logged_out", "message": "本地 B站会话已清除"}


def _datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _aware_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _integer(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(str(value).replace(",", "").replace("万", "0000")))
    except (TypeError, ValueError):
        return None


@router.get("/status")
def status() -> dict[str, Any]:
    user = _logged_user()
    return {
        "platform": "bilibili",
        "ready": True,
        "logged_in": bool(user),
        "user": user,
        "message": f"已登录：{user['name']}" if user else "B站公开内容采集入口已就绪；请先扫码登录后读取关注 UP 主。",
        "scope": "仅读取关注动态中的公开 UP 主、视频标题、播放/点赞等公开字段，不读取私信或隐私内容。",
    }


@router.post("/capture/followings")
def capture_followings(payload: dict[str, Any] | None = None, db: Session = Depends(get_db)) -> dict[str, Any]:
    user = _logged_user()
    if not user:
        raise HTTPException(status_code=401, detail="请先完成 B站扫码登录")
    options = payload or {}
    creator_limit = min(max(int(options.get("creator_limit", 20)), 1), 50)
    videos_per_creator = min(max(int(options.get("videos_per_creator", 5)), 5), 10)
    try:
        followings, _ = _fetch_all_followings(user["uid"])
        followings = followings[:creator_limit]
        items: list[dict[str, Any]] = []
        for creator in followings:
            uid = str(creator.get("mid"))
            name = str(creator.get("uname") or "").strip()
            for video in _fetch_videos(uid, videos_per_creator):
                items.append({"creator_name": name, "creator_uid": uid, **video})
        result = _capture_items(db, items)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"B站关注内容读取失败：{exc}") from exc
    new_count = result["content_count"]
    result.update({"status": "completed", "platform": "bilibili", "message": f"已读取 {new_count} 条新视频；当前共 {result['total_creator_count']} 位 UP 主、{result['total_content_count']} 条内容。" if new_count else f"没有新增视频；当前共 {result['total_creator_count']} 位 UP 主、{result['total_content_count']} 条内容。", "following_count": len(followings)})
    return result


@router.post("/capture")
def capture(payload: dict[str, Any], db: Session = Depends(get_db)) -> dict[str, Any]:
    items = payload.get("items", []) if isinstance(payload, dict) else []
    result = _capture_items(db, items)
    content_count = result["content_count"]
    total_creators = result["total_creator_count"]
    total_contents = result["total_content_count"]
    message = f"已读取 {content_count} 条新视频，当前共有 {total_creators} 位 UP 主、{total_contents} 条内容。" if content_count else f"没有新增视频；当前已有 {total_creators} 位 UP 主、{total_contents} 条内容。"
    return {"status": "completed", "platform": "bilibili", "message": message, **result}

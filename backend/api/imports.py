import csv
import io
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Content, Creator, ImportJob, now_utc
from backend.schemas import ImportRead
from backend.api.creators import creator_read

router = APIRouter()


def first_value(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    return None


def as_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(str(value).replace(",", "").replace("万", "0000")))
    except (TypeError, ValueError):
        return None


def as_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_records(filename: str, raw: bytes) -> list[dict[str, Any]]:
    if filename.lower().endswith(".json"):
        parsed = json.loads(raw.decode("utf-8-sig"))
        if isinstance(parsed, dict):
            parsed = parsed.get("items", parsed.get("data", [parsed]))
        if not isinstance(parsed, list):
            raise ValueError("JSON 顶层需要是数组，或包含 items/data 数组")
        return [item for item in parsed if isinstance(item, dict)]
    if filename.lower().endswith(".csv"):
        text = raw.decode("utf-8-sig")
        return list(csv.DictReader(io.StringIO(text)))
    raise ValueError("只支持 CSV 或 JSON 文件")


def content_key(creator_id: str, row: dict[str, Any]) -> tuple[str, str, str]:
    title = str(first_value(row, "title", "article_title", "文章标题") or "").strip().lower()
    url = str(first_value(row, "url", "链接", "原文链接") or "").strip()
    published = str(first_value(row, "published_at", "publish_time", "发布时间") or "").strip()
    return creator_id, url or title, published


@router.post("/", response_model=ImportRead)
async def import_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")
    raw = await file.read()
    try:
        records = normalize_records(file.filename, raw)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    creator_by_name: dict[str, Creator] = {}
    content_count = 0
    seen_keys: set[tuple[str, str, str]] = set()
    for row in records:
        name = str(first_value(row, "creator_name", "creator", "account", "name", "公众号", "账号") or "未命名账号").strip()
        creator = creator_by_name.get(name) or db.scalar(select(Creator).where(Creator.name == name, Creator.platform == "bilibili"))
        if not creator:
            creator = Creator(name=name, platform="bilibili", is_followed=True, last_sync_at=now_utc())
            db.add(creator)
            db.flush()
        creator_by_name[name] = creator
        title = first_value(row, "title", "article_title", "文章标题")
        if title:
            key = content_key(creator.id, row)
            existing = db.scalar(select(Content.id).where(Content.creator_id == creator.id, Content.title == str(title)))
            if key in seen_keys or existing:
                continue
            seen_keys.add(key)
            content = Content(
                creator_id=creator.id,
                title=str(title),
                summary=first_value(row, "summary", "摘要"),
                url=first_value(row, "url", "链接", "原文链接"),
                published_at=as_datetime(first_value(row, "published_at", "publish_time", "发布时间")),
                view_count=as_int(first_value(row, "view_count", "views", "阅读量")),
                like_count=as_int(first_value(row, "like_count", "likes", "点赞数")),
                share_count=as_int(first_value(row, "share_count", "shares", "在看")),
                comment_count=as_int(first_value(row, "comment_count", "comments", "评论数")),
                word_count=as_int(first_value(row, "word_count", "字数")),
                is_original=first_value(row, "is_original", "original", "原创") if first_value(row, "is_original", "original", "原创") is not None else None,
            )
            db.add(content)
            creator.article_count += 1
            if content.published_at and (creator.last_published_at is None or content.published_at > creator.last_published_at):
                creator.last_published_at = content.published_at
            content_count += 1
    job = ImportJob(filename=file.filename, file_type=file.filename.rsplit(".", 1)[-1].lower(), row_count=len(records), creator_count=len(creator_by_name), content_count=content_count)
    db.add(job)
    db.commit()
    items = [creator_read(creator) for creator in creator_by_name.values()]
    return ImportRead(job_id=job.id, filename=job.filename, row_count=job.row_count, creator_count=job.creator_count, content_count=job.content_count, status=job.status, items=items)

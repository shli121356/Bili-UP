import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models import Content, Creator
from backend.models import now_utc
from backend.schemas import ContentRead, CreatorDetail, CreatorRead, CreatorUpdate

router = APIRouter()


def creator_read(creator: Creator) -> CreatorRead:
    return CreatorRead(
        id=creator.id,
        platform=creator.platform,
        platform_uid=creator.platform_uid,
        name=creator.name,
        avatar_url=creator.avatar_url,
        follower_count=creator.follower_count,
        description=creator.description,
        category_main=creator.category_main,
        category_sub=creator.category_sub,
        custom_tags=json.loads(creator.custom_tags or "[]"),
        status=creator.status,
        heat_score=creator.heat_score,
        activity_score=creator.activity_score,
        quality_score=creator.quality_score,
        category_override=creator.category_override,
        status_override=creator.status_override,
        manual_notes=creator.manual_notes,
        heat_data_status=creator.heat_data_status,
        analysis_evidence=json.loads(creator.analysis_evidence or "[]"),
        top_keywords=json.loads(creator.top_keywords or "[]"),
        update_frequency=creator.update_frequency,
        weekly_count=creator.weekly_count,
        latest_video_title=creator.latest_video_title,
        latest_video_url=creator.latest_video_url,
        analyzed_at=creator.analyzed_at,
        article_count=creator.article_count,
        avg_views=creator.avg_views,
        avg_likes=creator.avg_likes,
        avg_shares=creator.avg_shares,
        last_published_at=creator.last_published_at,
        last_sync_at=creator.last_sync_at,
    )


def content_read(content: Content) -> ContentRead:
    return ContentRead(
        id=content.id,
        title=content.title,
        summary=content.summary,
        url=content.url,
        published_at=content.published_at,
        view_count=content.view_count,
        like_count=content.like_count,
        share_count=content.share_count,
        comment_count=content.comment_count,
        is_original=content.is_original,
        word_count=content.word_count,
        keywords=json.loads(content.keywords or "[]"),
        heat_score=content.heat_score,
        heat_data_status=content.heat_data_status,
    )


def _utc_datetime(value: datetime | None) -> datetime | None:
    """Normalize SQLite's naive timestamps before comparison/serialization."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


@router.get("/", response_model=dict)
def list_creators(
    db: Session = Depends(get_db),
    keyword: str | None = None,
    category_main: str | None = None,
    status: str | None = None,
    platform: str | None = Query(default=None),
    sort_by: str = Query("heat", pattern="^(heat|activity|name|last_published)$"),
):
    query = select(Creator)
    if platform:
        query = query.where(Creator.platform == platform)
        if platform == "bilibili":
            query = query.where(Creator.is_followed.is_(True))
    if keyword:
        query = query.where(or_(Creator.name.contains(keyword), Creator.description.contains(keyword)))
    if category_main:
        query = query.where(Creator.category_main == category_main)
    if status:
        query = query.where(Creator.status == status)
    order_column = {"heat": Creator.heat_score, "activity": Creator.activity_score, "name": Creator.name, "last_published": Creator.last_published_at}[sort_by]
    query = query.order_by(order_column.desc())
    items = [creator_read(item) for item in db.scalars(query).all()]
    return {"total": len(items), "page": 1, "page_size": len(items), "items": items}


@router.get("/{creator_id}", response_model=CreatorDetail)
def get_creator(creator_id: str, db: Session = Depends(get_db)):
    creator = db.scalar(select(Creator).options(selectinload(Creator.contents)).where(Creator.id == creator_id))
    if not creator:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="creator not found")
    contents = sorted(
        creator.contents,
        key=lambda item: _utc_datetime(item.published_at) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    dated = [item for item in contents if item.published_at]
    weekly: dict[str, int] = {}
    for item in dated:
        key = _utc_datetime(item.published_at).strftime("%Y-%W")
        weekly[key] = weekly.get(key, 0) + 1
    stats = {
        "total_articles": len(contents),
        "avg_views": round(sum(item.view_count for item in contents if item.view_count is not None) / max(1, sum(item.view_count is not None for item in contents))) if any(item.view_count is not None for item in contents) else None,
        "avg_likes": round(sum(item.like_count for item in contents if item.like_count is not None) / max(1, sum(item.like_count is not None for item in contents))) if any(item.like_count is not None for item in contents) else None,
        "avg_comments": round(sum(item.comment_count for item in contents if item.comment_count is not None) / max(1, sum(item.comment_count is not None for item in contents))) if any(item.comment_count is not None for item in contents) else None,
        "weekly_posts": weekly,
        "original_ratio": None,
    }
    originals = [item for item in contents if item.is_original is not None]
    if originals:
        stats["original_ratio"] = round(sum(item.is_original is True for item in originals) / len(originals) * 100, 1)
    result = CreatorDetail(**creator_read(creator).model_dump(), contents=[content_read(item) for item in contents], stats=stats)
    return result


@router.patch("/{creator_id}", response_model=CreatorRead)
def update_creator(creator_id: str, payload: CreatorUpdate, db: Session = Depends(get_db)):
    creator = db.get(Creator, creator_id)
    if not creator:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="creator not found")
    if payload.category_override is not None:
        creator.category_override = payload.category_override.strip() or None
        if creator.category_override:
            creator.category_main = creator.category_override
    if payload.status_override is not None:
        creator.status_override = payload.status_override.strip() or None
        if creator.status_override:
            creator.status = creator.status_override
    if payload.custom_tags is not None:
        creator.custom_tags = json.dumps(payload.custom_tags[:20], ensure_ascii=False)
    if payload.manual_notes is not None:
        creator.manual_notes = payload.manual_notes.strip() or None
    creator.manual_updated_at = now_utc()
    db.commit()
    db.refresh(creator)
    return creator_read(creator)

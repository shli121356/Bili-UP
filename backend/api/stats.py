from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Content, Creator, SyncTask

router = APIRouter()


@router.get("/overview")
def overview(db: Session = Depends(get_db), platform: str | None = Query(default=None)):
    filters = [Creator.platform == platform] if platform else []
    if platform == "bilibili":
        filters.append(Creator.is_followed.is_(True))
    total = db.scalar(select(func.count(Creator.id)).where(*filters)) or 0
    analyzed = db.scalar(select(func.count(Content.id)).join(Creator).where(*filters)) or 0
    priority = db.scalar(select(func.count(Creator.id)).where(*filters, Creator.status == "重点关注")) or 0
    review = db.scalar(select(func.count(Creator.id)).where(*filters, Creator.status == "待复核")) or 0
    avg_heat = db.scalar(select(func.avg(Creator.heat_score)).where(*filters)) or 0
    latest_sync = db.scalar(select(SyncTask).where(SyncTask.platform == "bilibili", SyncTask.status == "completed").order_by(SyncTask.finished_at.desc())) if platform in (None, "bilibili") else None
    return {"total_creators": total, "analyzed_contents": analyzed, "priority_creators": priority, "review_creators": review, "new_creators": latest_sync.new_creators if latest_sync else 0, "average_heat": round(avg_heat, 1)}

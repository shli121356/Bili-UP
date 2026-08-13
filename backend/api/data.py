import csv
import io

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from backend.api.creators import creator_read
from backend.database import get_db
from backend.models import Content, Creator, ImportJob

router = APIRouter()


@router.get("/export")
def export_data(db: Session = Depends(get_db), platform: str | None = Query(default=None)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["creator_name", "category", "status", "heat_score", "activity_score", "article_count", "top_keywords", "evidence"])
    query = db.query(Creator)
    if platform:
        query = query.filter(Creator.platform == platform)
        if platform == "bilibili":
            query = query.filter(Creator.is_followed.is_(True))
    for creator in query.order_by(Creator.heat_score.desc()).all():
        item = creator_read(creator)
        writer.writerow([item.name, item.category_override or item.category_main, item.status_override or item.status, item.heat_score, item.activity_score, item.article_count, "、".join(item.top_keywords), "；".join(item.analysis_evidence)])
    return Response(content="\ufeff" + output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=creator-insights.csv"})


@router.delete("/all")
def clear_all(db: Session = Depends(get_db)):
    db.execute(delete(Content))
    db.execute(delete(Creator))
    db.execute(delete(ImportJob))
    db.commit()
    return {"status": "cleared"}

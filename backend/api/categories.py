from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Creator

router = APIRouter()


@router.get("/")
def list_categories(db: Session = Depends(get_db), platform: str = "bilibili") -> dict[str, object]:
    filters = [Creator.platform == platform, Creator.is_followed.is_(True)]
    rows = db.execute(
        select(Creator.category_main, func.count(Creator.id))
        .where(*filters)
        .group_by(Creator.category_main)
        .order_by(func.count(Creator.id).desc())
    ).all()
    items: list[dict[str, object]] = []
    for name, count in rows:
        if name == "待同步 / 无样本":
            items.append({"name": name, "count": count, "children": []})
            continue
        children = db.execute(
            select(Creator.category_sub, func.count(Creator.id))
            .where(*filters, Creator.category_main == name, Creator.category_sub.is_not(None))
            .group_by(Creator.category_sub)
            .order_by(func.count(Creator.id).desc())
            .limit(6)
        ).all()
        items.append({
            "name": name or "其他 / 待分析",
            "count": count,
            "children": [{"name": child or "待细分", "count": child_count} for child, child_count in children],
        })
    return {"items": items}

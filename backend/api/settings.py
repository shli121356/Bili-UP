import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AnalysisSetting, now_utc
from backend.schemas import SettingsRead, SettingsUpdate

router = APIRouter()
DEFAULTS = SettingsRead()


def _number(rows: dict[str, str], key: str, default: int | float) -> int | float:
    try:
        return type(default)(rows.get(key, default))
    except (TypeError, ValueError):
        return default


def _mask_key(value: str) -> str:
    if not value:
        return ""
    return f"{'*' * max(4, len(value) - 4)}{value[-4:]}"


def read_settings(db: Session) -> SettingsRead:
    rows = {row.key: row.value for row in db.query(AnalysisSetting).all()}
    return SettingsRead(
        window_days=int(_number(rows, "window_days", DEFAULTS.window_days)),
        sample_size=int(_number(rows, "sample_size", DEFAULTS.sample_size)),
        videos_per_creator=int(_number(rows, "videos_per_creator", DEFAULTS.videos_per_creator)),
        delay_min=float(_number(rows, "delay_min", DEFAULTS.delay_min)),
        delay_max=float(_number(rows, "delay_max", DEFAULTS.delay_max)),
        llm_provider=rows.get("llm_provider", DEFAULTS.llm_provider),
        llm_base_url=rows.get("llm_base_url", DEFAULTS.llm_base_url),
        llm_model=rows.get("llm_model", DEFAULTS.llm_model),
        llm_api_key_masked=_mask_key(rows.get("llm_api_key", "")),
        weights=json.loads(rows.get("weights", json.dumps(DEFAULTS.weights))),
        categories=json.loads(rows.get("categories", "[]")),
    )


@router.get("/", response_model=SettingsRead)
def get_settings(db: Session = Depends(get_db)):
    return read_settings(db)


@router.put("/", response_model=SettingsRead)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    values = {
        "window_days": str(max(1, min(payload.window_days, 365))),
        "sample_size": str(max(1, min(payload.sample_size, 100))),
        "videos_per_creator": str(max(1, min(payload.videos_per_creator, 20))),
        "delay_min": str(max(0.05, min(payload.delay_min, 30))),
        "delay_max": str(max(payload.delay_min, min(payload.delay_max, 60))),
        "llm_provider": payload.llm_provider.strip()[:80],
        "llm_base_url": payload.llm_base_url.strip()[:500],
        "llm_model": payload.llm_model.strip()[:160],
        "weights": json.dumps(payload.weights, ensure_ascii=False),
        "categories": json.dumps(payload.categories[:30], ensure_ascii=False),
    }
    if payload.llm_api_key and not payload.llm_api_key.startswith("*"):
        values["llm_api_key"] = payload.llm_api_key.strip()[:500]
    for key, value in values.items():
        row = db.get(AnalysisSetting, key) or AnalysisSetting(key=key)
        row.value = value
        row.updated_at = now_utc()
        db.add(row)
    db.commit()
    return read_settings(db)

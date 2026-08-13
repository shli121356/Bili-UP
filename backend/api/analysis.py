from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.analysis import analyze_all
from backend.database import get_db
from backend.api.settings import read_settings

router = APIRouter()


@router.post("/run")
def run_analysis(db: Session = Depends(get_db), window_days: int = 90, platform: str | None = Query(default=None)):
    settings = read_settings(db)
    selected_window = window_days if window_days != 90 else settings.window_days
    return {"status": "completed", **analyze_all(db, window_days=max(1, min(selected_window, 365)), sample_size=settings.sample_size, weights=settings.weights, platform=platform)}

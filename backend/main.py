from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api import analysis, bilibili, categories, creators, environment, imports, settings, stats, wechat, data
from backend.database import init_db

app = FastAPI(title="创作者洞察台 API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(creators.router, prefix="/api/creators", tags=["creators"])
app.include_router(imports.router, prefix="/api/imports", tags=["imports"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(wechat.router, prefix="/api/wechat", tags=["wechat"])
app.include_router(bilibili.router, prefix="/api/bilibili", tags=["bilibili"])
app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(environment.router, prefix="/api/environment", tags=["environment"])

# Initialize and forward-migrate the local prototype database on import as well
# as on server startup, so tests and desktop launchers use the same behavior.
init_db()

@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "creator-manager"}


frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

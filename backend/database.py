from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import DATABASE_URL, ensure_data_dirs

ensure_data_dirs()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from backend import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    additions = {
        "creators": {
            "platform_uid": "VARCHAR(64)",
            "is_followed": "BOOLEAN DEFAULT 0",
            "avatar_url": "VARCHAR(1000)",
            "follower_count": "INTEGER",
            "category_override": "VARCHAR(64)",
            "status_override": "VARCHAR(32)",
            "manual_notes": "TEXT",
            "manual_updated_at": "DATETIME",
            "heat_data_status": "VARCHAR(32) DEFAULT 'insufficient'",
            "analysis_evidence": "TEXT DEFAULT '[]'",
            "top_keywords": "TEXT DEFAULT '[]'",
            "update_frequency": "FLOAT DEFAULT 0",
            "weekly_count": "INTEGER DEFAULT 0",
            "latest_video_title": "VARCHAR(300)",
            "latest_video_url": "VARCHAR(1000)",
            "analyzed_at": "DATETIME",
        },
        "contents": {
            "heat_score": "FLOAT",
            "heat_data_status": "VARCHAR(32) DEFAULT 'insufficient'",
        },
        "sync_tasks": {
            "new_creators": "INTEGER DEFAULT 0",
        },
    }
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table, columns in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))

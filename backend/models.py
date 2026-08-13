from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Creator(Base):
    __tablename__ = "creators"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    platform: Mapped[str] = mapped_column(String(32), default="bilibili", index=True)
    platform_uid: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_followed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    follower_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_main: Mapped[str] = mapped_column(String(64), default="其他", index=True)
    category_sub: Mapped[str | None] = mapped_column(String(64), nullable=True)
    custom_tags: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(32), default="观察中", index=True)
    heat_score: Mapped[float] = mapped_column(Float, default=0)
    activity_score: Mapped[float] = mapped_column(Float, default=0)
    quality_score: Mapped[float] = mapped_column(Float, default=0)
    category_override: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status_override: Mapped[str | None] = mapped_column(String(32), nullable=True)
    manual_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    manual_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    heat_data_status: Mapped[str] = mapped_column(String(32), default="insufficient")
    analysis_evidence: Mapped[str] = mapped_column(Text, default="[]")
    top_keywords: Mapped[str] = mapped_column(Text, default="[]")
    update_frequency: Mapped[float] = mapped_column(Float, default=0)
    weekly_count: Mapped[int] = mapped_column(Integer, default=0)
    latest_video_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    latest_video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    article_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_likes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_shares: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    contents: Mapped[list["Content"]] = relationship(back_populates="creator", cascade="all, delete-orphan")


class Content(Base):
    __tablename__ = "contents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    creator_id: Mapped[str] = mapped_column(ForeignKey("creators.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    view_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    like_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    share_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_original: Mapped[bool | None] = mapped_column(nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    keywords: Mapped[str] = mapped_column(Text, default="[]")
    heat_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    heat_data_status: Mapped[str] = mapped_column(String(32), default="insufficient")
    creator: Mapped[Creator] = relationship(back_populates="contents")


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(16))
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    creator_count: Mapped[int] = mapped_column(Integer, default=0)
    content_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="completed")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class SyncTask(Base):
    __tablename__ = "sync_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    platform: Mapped[str] = mapped_column(String(32), default="bilibili", index=True)
    status: Mapped[str] = mapped_column(String(24), default="running", index=True)
    phase: Mapped[str] = mapped_column(String(32), default="starting")
    message: Mapped[str] = mapped_column(Text, default="")
    following_total: Mapped[int] = mapped_column(Integer, default=0)
    followings_processed: Mapped[int] = mapped_column(Integer, default=0)
    videos_scanned: Mapped[int] = mapped_column(Integer, default=0)
    new_content: Mapped[int] = mapped_column(Integer, default=0)
    new_creators: Mapped[int] = mapped_column(Integer, default=0)
    total_creator_count: Mapped[int] = mapped_column(Integer, default=0)
    total_content_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class AnalysisSetting(Base):
    __tablename__ = "analysis_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

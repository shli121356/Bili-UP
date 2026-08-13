from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ContentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    summary: str | None = None
    url: str | None = None
    published_at: datetime | None = None
    view_count: int | None = None
    like_count: int | None = None
    share_count: int | None = None
    comment_count: int | None = None
    is_original: bool | None = None
    word_count: int | None = None
    keywords: list[str] = Field(default_factory=list)
    heat_score: float | None = None
    heat_data_status: str = "insufficient"


class CreatorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    platform: str
    platform_uid: str | None = None
    name: str
    avatar_url: str | None = None
    follower_count: int | None = None
    description: str | None = None
    category_main: str
    category_sub: str | None = None
    custom_tags: list[str] = Field(default_factory=list)
    status: str
    heat_score: float
    activity_score: float
    quality_score: float
    category_override: str | None = None
    status_override: str | None = None
    manual_notes: str | None = None
    heat_data_status: str = "insufficient"
    analysis_evidence: list[str] = Field(default_factory=list)
    top_keywords: list[str] = Field(default_factory=list)
    update_frequency: float = 0
    weekly_count: int = 0
    latest_video_title: str | None = None
    latest_video_url: str | None = None
    analyzed_at: datetime | None = None
    article_count: int
    avg_views: int | None = None
    avg_likes: int | None = None
    avg_shares: int | None = None
    last_published_at: datetime | None = None
    last_sync_at: datetime | None = None


class CreatorDetail(CreatorRead):
    contents: list[ContentRead] = Field(default_factory=list)
    stats: dict[str, Any] = Field(default_factory=dict)


class ImportRead(BaseModel):
    job_id: str
    filename: str
    row_count: int
    creator_count: int
    content_count: int
    status: str
    items: list[CreatorRead]


class CreatorUpdate(BaseModel):
    category_override: str | None = None
    status_override: str | None = None
    custom_tags: list[str] | None = None
    manual_notes: str | None = None


class SettingsRead(BaseModel):
    window_days: int = 90
    sample_size: int = 20
    videos_per_creator: int = 5
    delay_min: float = 0.25
    delay_max: float = 0.65
    llm_provider: str = "local"
    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key_masked: str = ""
    weights: dict[str, float] = Field(default_factory=lambda: {"views": 0.45, "likes": 0.25, "shares": 0.2, "comments": 0.1})
    categories: list[str] = Field(default_factory=list)


class SettingsUpdate(SettingsRead):
    llm_api_key: str | None = None

import json
import math
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.models import Content, Creator, now_utc


CATEGORY_RULES = {
    "AI / 大模型": ["AI", "AIGC", "人工智能", "大模型", "模型", "Agent", "生成式", "LoRA", "提示词", "多模态"],
    "科技 / 数码": ["科技", "数码", "手机", "电脑", "硬件", "芯片", "显卡", "相机", "评测"],
    "编程 / 开发": ["编程", "代码", "开发", "程序员", "算法", "开源", "Python", "前端", "后端", "数据库"],
    "软件 / 工具": ["软件", "工具", "效率", "工作流", "自动化", "插件", "网站", "应用", "教程"],
    "产品 / 设计": ["产品", "设计", "用户", "体验", "交互", "UI", "UX", "视觉", "Figma", "运营"],
    "商业 / 投资": ["商业", "投资", "创业", "公司", "融资", "消费", "增长", "品牌", "经济", "市场"],
    "教育 / 学习": ["教育", "学习", "课程", "知识", "考试", "考研", "英语", "方法论", "科普"],
    "职业 / 成长": ["职场", "职业", "成长", "沟通", "面试", "领导力", "管理", "求职", "个人提升"],
    "游戏 / 动画": ["游戏", "电竞", "手游", "主机", "Steam", "动画", "动漫", "二次元"],
    "影视 / 娱乐": ["电影", "电视剧", "影视", "综艺", "娱乐", "明星", "解说", "纪录片"],
    "音乐 / 舞蹈": ["音乐", "歌曲", "乐器", "舞蹈", "翻唱", "演奏", "MV"],
    "旅行 / 生活": ["旅行", "旅游", "城市", "生活", "日常", "家居", "穿搭", "Vlog"],
    "美食 / 健康": ["美食", "料理", "做饭", "健身", "健康", "心理", "减脂", "食谱"],
    "汽车 / 交通": ["汽车", "车辆", "新能源", "驾驶", "摩托", "交通", "车评"],
    "体育 / 运动": ["体育", "运动", "篮球", "足球", "跑步", "健身", "比赛"],
    "新闻 / 社会": ["新闻", "资讯", "发布", "政策", "行业动态", "热点", "事件", "报道", "社会"],
    "摄影 / 视觉": ["摄影", "相机", "镜头", "后期", "修图", "调色", "构图", "胶片"],
    "知识 / 科普": ["科普", "原理", "实验", "历史", "地理", "科学", "冷知识", "揭秘"],
    "居家 / 家装": ["家装", "装修", "家居", "收纳", "家具", "租房", "房间", "居家"],
    "美妆 / 穿搭": ["美妆", "化妆", "护肤", "穿搭", "服饰", "发型", "彩妆"],
}
KEYWORD_POOL = sorted({word for words in CATEGORY_RULES.values() for word in words}, key=len, reverse=True)


def _text(content: Content) -> str:
    return f"{content.title} {content.summary or ''}".strip()


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _keywords(text: str) -> list[str]:
    hits = [word for word in KEYWORD_POOL if word.lower() in text.lower()]
    if hits:
        return hits[:6]
    # Keep a few meaningful Chinese phrases when the title does not match the rules.
    phrases = re.findall(r"[\u4e00-\u9fff]{2,6}", text)
    return [word for word, _ in Counter(phrases).most_common(5)]


def _category(text: str) -> tuple[str, int]:
    scores = {category: sum(text.lower().count(word.lower()) for word in words) for category, words in CATEGORY_RULES.items()}
    category, score = max(scores.items(), key=lambda item: item[1])
    if score:
        return category, score
    fallback_rules = [
        ("知识 / 科普", ["分享", "讲解", "知识", "入门", "教程"]),
        ("创意 / 故事", ["故事", "创意", "短片", "作品", "挑战"]),
        ("生活方式 / 日常", ["日常", "记录", "生活", "体验"]),
    ]
    for fallback, words in fallback_rules:
        hits = sum(text.lower().count(word.lower()) for word in words)
        if hits:
            return fallback, hits
    return "待同步 / 无样本", 0


def _normalize(value: int | None, maximum: int | None) -> float | None:
    if value is None or maximum in (None, 0):
        return None
    return min(100.0, value / maximum * 100)


def _content_heat(content: Content, maxima: dict[str, int], weights: dict[str, float] | None = None) -> tuple[float | None, str]:
    metrics = [("view_count", 0.45), ("like_count", 0.25), ("share_count", 0.20), ("comment_count", 0.10)]
    weight_map = weights or {"views": .45, "likes": .25, "shares": .20, "comments": .10}
    metrics = [("view_count", weight_map.get("views", .45)), ("like_count", weight_map.get("likes", .25)), ("share_count", weight_map.get("shares", .20)), ("comment_count", weight_map.get("comments", .10))]
    available = [(getattr(content, field), weight, maxima[field]) for field, weight in metrics if getattr(content, field) is not None and maxima[field] and weight > 0]
    if not available:
        return None, "insufficient"
    weight_total = sum(weight for _, weight, _ in available)
    score = sum((value / maximum * 100) * weight for value, weight, maximum in available) / weight_total
    return round(score, 1), "complete" if len(available) == 4 else "partial"


def analyze_all(db: Session, window_days: int = 90, sample_size: int = 20, weights: dict[str, float] | None = None, platform: str | None = None) -> dict[str, int | float]:
    now = now_utc()
    since = now - timedelta(days=window_days)
    contents = list(db.scalars(select(Content).options(selectinload(Content.creator))).all())
    if platform:
        contents = [item for item in contents if item.creator and item.creator.platform == platform]
    scoped = [item for item in contents if _aware(item.published_at) is None or _aware(item.published_at) >= since]
    scoped.sort(key=lambda item: _aware(item.published_at) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    maxima = {field: max((getattr(item, field) or 0 for item in scoped), default=0) for field in ("view_count", "like_count", "share_count", "comment_count")}
    all_by_creator: dict[str, list[Content]] = {}
    by_creator: dict[str, list[Content]] = {}
    for content in scoped:
        all_by_creator.setdefault(content.creator_id, []).append(content)
        content.keywords = json.dumps(_keywords(_text(content)), ensure_ascii=False)
        content.heat_score, content.heat_data_status = _content_heat(content, maxima, weights)
    for creator_id, rows in all_by_creator.items():
        by_creator[creator_id] = rows[:5]

    analyzed = 0
    creators_query = select(Creator)
    if platform:
        creators_query = creators_query.where(Creator.platform == platform)
    creator_rows = list(db.scalars(creators_query).all())
    follower_max = max((item.follower_count or 0 for item in creator_rows), default=0)
    publish_max = max((len(all_by_creator.get(item.id, [])) for item in creator_rows), default=0)
    # Calculate creator averages first; quality normalization must use this run's
    # values, otherwise the first analysis incorrectly compares against stale zeros.
    creator_like_averages: dict[str, float] = {}
    for creator in creator_rows:
        rows = by_creator.get(creator.id, [])
        likes = [row.like_count for row in rows if row.like_count is not None]
        if likes:
            creator_like_averages[creator.id] = sum(likes) / len(likes)
    likes_max = max(creator_like_averages.values(), default=0)
    for creator in creator_rows:
        rows = by_creator.get(creator.id, [])
        if not rows:
            # Never keep a stale broad category after a creator has no current
            # video sample. It is more honest and actionable to surface the
            # missing-sample state so the next sync can classify it.
            creator.category_main = creator.category_override or "待同步 / 无样本"
            creator.category_sub = None
            creator.top_keywords = "[]"
            creator.article_count = 0
            creator.avg_views = None
            creator.avg_likes = None
            creator.avg_shares = None
            creator.weekly_count = 0
            creator.update_frequency = 0
            creator.activity_score = 0
            creator.quality_score = 0
            creator.heat_data_status = "insufficient"
            creator.analysis_evidence = json.dumps(["当前没有可用的最新视频样本，请先同步该 UP 主的公开内容"], ensure_ascii=False)
            continue
        category_scores = Counter()
        keyword_counts = Counter()
        for row in rows:
            category, score = _category(_text(row))
            category_scores[category] += max(score, 1)
            keyword_counts.update(json.loads(row.keywords or "[]"))
        category, category_score = category_scores.most_common(1)[0]
        creator.category_main = creator.category_override or category
        creator.category_sub = keyword_counts.most_common(1)[0][0] if keyword_counts else None
        creator.top_keywords = json.dumps([word for word, _ in keyword_counts.most_common(6)], ensure_ascii=False)
        all_rows = all_by_creator.get(creator.id, rows)
        creator.article_count = len(all_rows)
        creator.avg_views = round(sum(row.view_count for row in rows if row.view_count is not None) / max(1, sum(row.view_count is not None for row in rows))) if any(row.view_count is not None for row in rows) else None
        creator.avg_likes = round(sum(row.like_count for row in rows if row.like_count is not None) / max(1, sum(row.like_count is not None for row in rows))) if any(row.like_count is not None for row in rows) else None
        creator.avg_shares = round(sum(row.share_count for row in rows if row.share_count is not None) / max(1, sum(row.share_count is not None for row in rows))) if any(row.share_count is not None for row in rows) else None
        scored = [row.heat_score for row in rows if row.heat_score is not None]
        dated = sorted((_aware(row.published_at) for row in rows if row.published_at), reverse=True)
        creator.last_published_at = dated[0] if dated else creator.last_published_at
        recent_since = now - timedelta(days=7)
        creator.weekly_count = sum(1 for row in all_rows if _aware(row.published_at) and _aware(row.published_at) >= recent_since)
        creator.update_frequency = float(creator.weekly_count)
        creator.activity_score = round(min(100, creator.weekly_count / 7 * 100), 1)
        creator.heat_data_status = "complete" if all(row.heat_data_status == "complete" for row in rows) else ("partial" if scored else "insufficient")
        # Heat is intentionally creator-level: audience size, publishing volume,
        # and recent activity are the three signals shown in the product.
        follower_score = min(100, (creator.follower_count or 0) / follower_max * 100) if follower_max else 0
        publish_score = min(100, len(all_rows) / publish_max * 100) if publish_max else 0
        creator.heat_score = round(follower_score * .45 + publish_score * .25 + creator.activity_score * .30, 1)
        latest = all_rows[0] if all_rows else None
        if latest:
            creator.latest_video_title = latest.title
            creator.latest_video_url = latest.url
        like_values = [row.like_count for row in rows if row.like_count is not None]
        creator.quality_score = round(min(100, creator_like_averages.get(creator.id, 0) / likes_max * 100), 1) if like_values and likes_max else 0
        evidence = [f"基于最新 {len(rows)} 条视频判定为 {category}，主题占比约 {round(category_score / max(sum(category_scores.values()), 1) * 100)}%"]
        if keyword_counts:
            evidence.append(f"高频主题词：{'、'.join(word for word, _ in keyword_counts.most_common(5))}")
        else:
            evidence.append(f"已分析 {len(rows)} 篇文章，标题关键词不足")
        evidence.append(f"热度口径：粉丝量 45% · 发布量 25% · 近 7 天活跃度 30%；质量按平均点赞归一化")
        if creator.heat_data_status != "complete":
            evidence.append("部分互动字段未公开，已按可用公开字段计算")
        creator.analysis_evidence = json.dumps(evidence[:4], ensure_ascii=False)
        if not creator.status_override and creator.status not in {"重点关注", "低优先级", "已忽略"}:
            creator.status = "重点关注" if creator.heat_score >= 75 else "观察中"
        creator.analyzed_at = now
        analyzed += len(rows)
    db.commit()
    return {"creators": len(by_creator), "contents": analyzed, "window_days": window_days}

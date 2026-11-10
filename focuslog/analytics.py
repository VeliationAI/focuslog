"""Formatting helpers for reports and the CLI."""

from __future__ import annotations

from typing import Any


CATEGORY_LABELS = {
    "chat": "Chat / Slack",
    "social": "Social media",
    "email": "Email",
    "phone": "Phone",
    "web": "Web browsing",
    "meetings": "Meetings",
    "people": "People",
    "environment": "Environment",
    "other": "Other",
}


def format_duration(seconds: int | float | None) -> str:
    seconds = int(seconds or 0)
    if seconds < 60:
        return f"{seconds}s"
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}h {minutes:02d}m"
    if secs and minutes < 10:
        return f"{minutes}m {secs:02d}s"
    return f"{minutes}m"


def category_label(category: str) -> str:
    key = (category or "other").lower()
    return CATEGORY_LABELS.get(key, category.replace("_", " ").title())


def summarize_week(report: dict[str, Any]) -> list[str]:
    t = report["totals"]
    lines = [
        f"Week of {report['week_start']} → {report['week_end']}",
        f"Focus sessions: {t['sessions']}  ·  completed {t['completed']}  ·  aborted {t['aborted']}",
        f"Focus time: {format_duration(t['focus_seconds'])}  ·  completion {t['completion_rate']}%",
        f"Distractions: {t['distractions']}  ·  {t['distractions_per_session']}/session",
    ]
    if report["top_categories"]:
        top = report["top_categories"][0]
        lines.append(
            f"Top distraction category: {category_label(top['category'])} ({top['count']})"
        )
    if report["top_reasons"]:
        r = report["top_reasons"][0]
        lines.append(f"Most common pull: “{r['reason']}” ({r['count']}×)")
    return lines

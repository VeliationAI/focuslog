"""Product insights — turn raw distraction data into actionable coaching."""

from __future__ import annotations

from typing import Any

from focuslog.analytics import category_label, format_duration

COACHING = {
    "chat": "Mute non-critical channels for the next block, or batch replies after two Pomodoros.",
    "social": "Park social apps behind a full-screen focus session — open them only on breaks.",
    "email": "Check email on a schedule (e.g. 11:30 / 16:00) instead of mid-focus.",
    "phone": "Phone face-down in another room. If you need it, log every unlock.",
    "web": "Close unused tabs before start. Use one window for the task only.",
    "meetings": "Defend morning deep-work with no-meeting windows on your calendar.",
    "people": "Put a visible ‘focus until :XX’ note up — interruptions drop when expectations are clear.",
    "environment": "Fix the environment once: snacks, water, noise — so it stops taxing willpower.",
    "other": "Name the pull precisely next time. Specific logs become specific fixes.",
}


def build_insight(week: dict[str, Any], *, streak_days: int = 0) -> dict[str, Any]:
    totals = week.get("totals") or {}
    top_cats = week.get("top_categories") or []
    top_reasons = week.get("top_reasons") or []
    sessions = totals.get("sessions") or 0
    distractions = totals.get("distractions") or 0

    if sessions == 0 and distractions == 0:
        return {
            "headline": "Start your first focus block",
            "body": "Protect 25 minutes. When attention breaks, log what pulled you — that’s the product.",
            "severity": "idle",
            "cta": "Start focus",
        }

    if top_cats:
        cat = top_cats[0]["category"]
        count = top_cats[0]["count"]
        reason = top_reasons[0]["reason"] if top_reasons else None
        headline = f"Your #1 pull this week: {category_label(cat)}"
        detail = (
            f"“{reason}” leads the list ({top_reasons[0]['count']}×). "
            if reason
            else f"{count} logged pulls in this category. "
        )
        return {
            "headline": headline,
            "body": detail + COACHING.get(cat, COACHING["other"]),
            "severity": "coach",
            "category": cat,
            "cta": "Log the next pull",
        }

    if (totals.get("completion_rate") or 0) >= 80 and sessions >= 3:
        return {
            "headline": f"Strong week — {totals.get('completion_rate')}% completion",
            "body": (
                f"{format_duration(totals.get('focus_seconds'))} protected"
                + (f", {streak_days}-day streak." if streak_days else ".")
                + " Keep logging even rare pulls — quiet weeks still teach."
            ),
            "severity": "win",
            "cta": "Start another block",
        }

    return {
        "headline": f"{sessions} sessions · {distractions} distractions",
        "body": "Patterns sharpen after a few logged pulls. Keep the ledger honest.",
        "severity": "neutral",
        "cta": "Continue",
    }


def product_copy() -> dict[str, Any]:
    return {
        "name": "Focus Log",
        "tagline": "Know what steals your attention",
        "promise": "Timers count minutes. Focus Log ranks interruptions — so you can change the environment, not just the willpower.",
        "loop": [
            {
                "step": "01",
                "title": "Protect a block",
                "body": "Start a Pomodoro. One job. A clear end.",
            },
            {
                "step": "02",
                "title": "Log the pull",
                "body": "When focus breaks, name it in one breath — Slack, phone, curiosity tab.",
            },
            {
                "step": "03",
                "title": "Read the week",
                "body": "Friday shows your top distractions. Fix the top one first.",
            },
        ],
    }

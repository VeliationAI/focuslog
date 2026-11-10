"""SQLite persistence for sessions and distractions."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

DEFAULT_DB = Path.home() / ".focuslog" / "focuslog.db"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


class Database:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or DEFAULT_DB
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL DEFAULT 'focus',
                    label TEXT NOT NULL DEFAULT '',
                    planned_minutes INTEGER NOT NULL,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    focus_seconds INTEGER NOT NULL DEFAULT 0,
                    notes TEXT NOT NULL DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS distractions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    reason TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'other',
                    logged_at TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS idx_sessions_started
                    ON sessions(started_at);
                CREATE INDEX IF NOT EXISTS idx_distractions_logged
                    ON distractions(logged_at);
                CREATE INDEX IF NOT EXISTS idx_distractions_category
                    ON distractions(category);
                """
            )

    def start_session(
        self,
        *,
        kind: str = "focus",
        label: str = "",
        planned_minutes: int = 25,
    ) -> dict[str, Any]:
        active = self.get_active_session()
        if active:
            raise RuntimeError(
                f"Session #{active['id']} is already active. "
                "Finish or abort it before starting another."
            )
        started = to_iso(utcnow())
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO sessions (kind, label, planned_minutes, started_at, status)
                VALUES (?, ?, ?, ?, 'active')
                """,
                (kind, label.strip(), planned_minutes, started),
            )
            session_id = cur.lastrowid
        return self.get_session(session_id)  # type: ignore[return-value]

    def get_session(self, session_id: int) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
        return dict(row) if row else None

    def get_active_session(self) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM sessions
                WHERE status = 'active'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        return dict(row) if row else None

    def finish_session(
        self,
        session_id: int | None = None,
        *,
        status: str = "completed",
        notes: str = "",
    ) -> dict[str, Any]:
        session = self.get_active_session() if session_id is None else self.get_session(session_id)
        if not session:
            raise RuntimeError("No session found to finish.")
        if session["status"] != "active":
            raise RuntimeError(f"Session #{session['id']} is already {session['status']}.")

        ended = utcnow()
        started = parse_iso(session["started_at"])
        focus_seconds = max(0, int((ended - started).total_seconds()))
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE sessions
                SET ended_at = ?, status = ?, focus_seconds = ?, notes = ?
                WHERE id = ?
                """,
                (to_iso(ended), status, focus_seconds, notes.strip(), session["id"]),
            )
        return self.get_session(session["id"])  # type: ignore[return-value]

    def log_distraction(
        self,
        reason: str,
        *,
        category: str = "other",
        notes: str = "",
        session_id: int | None = None,
    ) -> dict[str, Any]:
        reason = reason.strip()
        if not reason:
            raise ValueError("Distraction reason cannot be empty.")
        category = (category or "other").strip().lower().replace(" ", "_")
        active = self.get_active_session()
        sid = session_id if session_id is not None else (active["id"] if active else None)
        logged_at = to_iso(utcnow())
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO distractions (session_id, reason, category, logged_at, notes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (sid, reason, category, logged_at, notes.strip()),
            )
            distraction_id = cur.lastrowid
            row = conn.execute(
                "SELECT * FROM distractions WHERE id = ?", (distraction_id,)
            ).fetchone()
        return dict(row)

    def list_sessions(self, *, days: int = 7, limit: int = 50) -> list[dict[str, Any]]:
        since = to_iso(utcnow() - timedelta(days=days))
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT s.*,
                       (SELECT COUNT(*) FROM distractions d WHERE d.session_id = s.id)
                       AS distraction_count
                FROM sessions s
                WHERE s.started_at >= ?
                ORDER BY s.started_at DESC
                LIMIT ?
                """,
                (since, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def list_distractions(self, *, days: int = 7, limit: int = 100) -> list[dict[str, Any]]:
        since = to_iso(utcnow() - timedelta(days=days))
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT d.*, s.label AS session_label, s.kind AS session_kind
                FROM distractions d
                LEFT JOIN sessions s ON s.id = d.session_id
                WHERE d.logged_at >= ?
                ORDER BY d.logged_at DESC
                LIMIT ?
                """,
                (since, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def weekly_report(self, *, weeks_ago: int = 0) -> dict[str, Any]:
        """Return analytics for a calendar week (Mon–Sun in local time)."""
        local_now = datetime.now().astimezone()
        today = local_now.date()
        monday = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks_ago)
        sunday = monday + timedelta(days=6)
        tz = local_now.tzinfo or timezone.utc
        start = datetime(monday.year, monday.month, monday.day, tzinfo=tz)
        end = datetime(sunday.year, sunday.month, sunday.day, 23, 59, 59, tzinfo=tz)
        start_iso, end_iso = to_iso(start), to_iso(end)

        with self.connect() as conn:
            sessions = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT * FROM sessions
                    WHERE started_at >= ? AND started_at <= ?
                    ORDER BY started_at
                    """,
                    (start_iso, end_iso),
                ).fetchall()
            ]
            distractions = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT * FROM distractions
                    WHERE logged_at >= ? AND logged_at <= ?
                    ORDER BY logged_at
                    """,
                    (start_iso, end_iso),
                ).fetchall()
            ]
            top_categories = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT category, COUNT(*) AS count
                    FROM distractions
                    WHERE logged_at >= ? AND logged_at <= ?
                    GROUP BY category
                    ORDER BY count DESC, category ASC
                    """,
                    (start_iso, end_iso),
                ).fetchall()
            ]
            top_reasons = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT reason, category, COUNT(*) AS count
                    FROM distractions
                    WHERE logged_at >= ? AND logged_at <= ?
                    GROUP BY reason, category
                    ORDER BY count DESC, reason ASC
                    LIMIT 10
                    """,
                    (start_iso, end_iso),
                ).fetchall()
            ]
            daily = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT substr(started_at, 1, 10) AS day,
                           COUNT(*) AS sessions,
                           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                           SUM(focus_seconds) AS focus_seconds
                    FROM sessions
                    WHERE started_at >= ? AND started_at <= ?
                    GROUP BY substr(started_at, 1, 10)
                    ORDER BY day
                    """,
                    (start_iso, end_iso),
                ).fetchall()
            ]
            daily_distractions = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT substr(logged_at, 1, 10) AS day, COUNT(*) AS count
                    FROM distractions
                    WHERE logged_at >= ? AND logged_at <= ?
                    GROUP BY substr(logged_at, 1, 10)
                    ORDER BY day
                    """,
                    (start_iso, end_iso),
                ).fetchall()
            ]

        focus_sessions = [s for s in sessions if s["kind"] == "focus"]
        completed = [s for s in focus_sessions if s["status"] == "completed"]
        aborted = [s for s in focus_sessions if s["status"] == "aborted"]
        total_focus = sum(s["focus_seconds"] or 0 for s in focus_sessions)
        planned = sum((s["planned_minutes"] or 0) * 60 for s in completed)
        distraction_count = len(distractions)
        completion_rate = (
            round(100 * len(completed) / len(focus_sessions), 1) if focus_sessions else 0.0
        )
        distractions_per_session = (
            round(distraction_count / len(focus_sessions), 2) if focus_sessions else 0.0
        )
        focus_efficiency = (
            round(100 * total_focus / planned, 1) if planned else 0.0
        )

        # Build full 7-day series
        distract_by_day = {d["day"]: d["count"] for d in daily_distractions}
        session_by_day = {d["day"]: d for d in daily}
        day_series = []
        for i in range(7):
            day = (monday + timedelta(days=i)).isoformat()
            s = session_by_day.get(day, {})
            day_series.append(
                {
                    "day": day,
                    "weekday": (monday + timedelta(days=i)).strftime("%a"),
                    "sessions": s.get("sessions", 0) or 0,
                    "completed": s.get("completed", 0) or 0,
                    "focus_seconds": s.get("focus_seconds", 0) or 0,
                    "distractions": distract_by_day.get(day, 0),
                }
            )

        return {
            "week_start": monday.isoformat(),
            "week_end": sunday.isoformat(),
            "weeks_ago": weeks_ago,
            "totals": {
                "sessions": len(focus_sessions),
                "completed": len(completed),
                "aborted": len(aborted),
                "breaks": len([s for s in sessions if s["kind"] == "break"]),
                "focus_seconds": total_focus,
                "distractions": distraction_count,
                "completion_rate": completion_rate,
                "distractions_per_session": distractions_per_session,
                "focus_efficiency": focus_efficiency,
            },
            "top_categories": top_categories,
            "top_reasons": top_reasons,
            "day_series": day_series,
            "recent_distractions": distractions[-20:][::-1],
            "recent_sessions": sessions[-20:][::-1],
        }

    def streak_days(self) -> int:
        """Consecutive local calendar days (ending today) with a completed focus session."""
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT started_at FROM sessions
                WHERE kind = 'focus' AND status = 'completed'
                ORDER BY started_at DESC
                LIMIT 400
                """
            ).fetchall()
        if not rows:
            return 0
        local_tz = datetime.now().astimezone().tzinfo or timezone.utc
        days = {
            parse_iso(r["started_at"]).astimezone(local_tz).date()
            for r in rows
        }
        cursor = datetime.now().astimezone(local_tz).date()
        streak = 0
        while cursor in days:
            streak += 1
            cursor -= timedelta(days=1)
        return streak

    def all_time_stats(self) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT
                    COUNT(*) AS sessions,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                    SUM(focus_seconds) AS focus_seconds
                FROM sessions
                WHERE kind = 'focus'
                """
            ).fetchone()
            distract = conn.execute(
                "SELECT COUNT(*) AS c FROM distractions"
            ).fetchone()["c"]
        return {
            "sessions": row["sessions"] or 0,
            "completed": row["completed"] or 0,
            "focus_seconds": row["focus_seconds"] or 0,
            "distractions": distract or 0,
        }

    def overview(self) -> dict[str, Any]:
        from focuslog.insights import build_insight, product_copy

        active = self.get_active_session()
        week = self.weekly_report(weeks_ago=0)
        streak = self.streak_days()
        recent_distractions = self.list_distractions(days=7, limit=12)
        recent_sessions = self.list_sessions(days=7, limit=12)
        return {
            "active_session": active,
            "week": week,
            "recent_distractions": recent_distractions,
            "recent_sessions": recent_sessions,
            "streak_days": streak,
            "all_time": self.all_time_stats(),
            "insight": build_insight(week, streak_days=streak),
            "product": product_copy(),
        }

    def seed_demo(self) -> None:
        """Populate a light demo week if the database is empty."""
        with self.connect() as conn:
            count = conn.execute("SELECT COUNT(*) AS c FROM sessions").fetchone()["c"]
        if count:
            return

        local_now = datetime.now().astimezone()
        monday = local_now.date() - timedelta(days=local_now.date().weekday())
        demo_plan = [
            (0, 9, 25, "Deep work — API design", "completed", [("Slack ping", "chat"), ("Curiosity tab", "web")]),
            (0, 14, 25, "Write docs", "completed", [("Phone buzz", "phone")]),
            (1, 10, 25, "Refactor timer", "aborted", [("Meeting invite", "meetings"), ("Snack run", "environment")]),
            (1, 16, 25, "Bug bash", "completed", []),
            (2, 9, 50, "Feature sprint", "completed", [("Twitter", "social"), ("Email", "email"), ("Email again", "email")]),
            (2, 15, 25, "Code review", "completed", [("Coworker question", "people")]),
            (3, 11, 25, "Analytics sketch", "completed", [("YouTube short", "social")]),
            (4, 8, 25, "Morning block", "completed", []),
            (4, 13, 25, "Dashboard polish", "completed", [("Reddit", "social"), ("Slack", "chat")]),
        ]
        local_tz = datetime.now().astimezone().tzinfo or timezone.utc
        with self.connect() as conn:
            for day_offset, hour, minutes, label, status, distracts in demo_plan:
                started = datetime(
                    monday.year,
                    monday.month,
                    monday.day,
                    hour,
                    0,
                    tzinfo=local_tz,
                ) + timedelta(days=day_offset)
                ended = started + timedelta(minutes=minutes if status == "completed" else 12)
                cur = conn.execute(
                    """
                    INSERT INTO sessions
                    (kind, label, planned_minutes, started_at, ended_at, status, focus_seconds)
                    VALUES ('focus', ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        label,
                        minutes,
                        to_iso(started),
                        to_iso(ended),
                        status,
                        int((ended - started).total_seconds()),
                    ),
                )
                sid = cur.lastrowid
                for i, (reason, category) in enumerate(distracts):
                    logged = started + timedelta(minutes=3 + i * 4)
                    conn.execute(
                        """
                        INSERT INTO distractions (session_id, reason, category, logged_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (sid, reason, category, to_iso(logged)),
                    )


def export_json(db: Database, days: int = 30) -> str:
    payload = {
        "sessions": db.list_sessions(days=days, limit=1000),
        "distractions": db.list_distractions(days=days, limit=5000),
        "week": db.weekly_report(weeks_ago=0),
    }
    return json.dumps(payload, indent=2)

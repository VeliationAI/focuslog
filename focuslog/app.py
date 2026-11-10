"""Production ASGI entrypoint for Focus Log."""

from __future__ import annotations

import os
from pathlib import Path

from focuslog.db import Database
from focuslog.server import create_app


def _resolve_db_path() -> Path | None:
    raw = os.environ.get("FOCUSLOG_DB", "").strip()
    return Path(raw) if raw else None


def build() -> object:
    db_path = _resolve_db_path()
    if os.environ.get("FOCUSLOG_SEED", "").lower() in {"1", "true", "yes"}:
        Database(db_path).seed_demo()
    return create_app(db_path=db_path)


app = build()

"""Tiny FastAPI dashboard for Focus Log."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from focuslog import __version__
from focuslog.analytics import category_label, format_duration
from focuslog.db import Database
from focuslog.insights import product_copy

PACKAGE_DIR = Path(__file__).resolve().parent
TEMPLATES = Jinja2Templates(directory=str(PACKAGE_DIR / "templates"))


class StartBody(BaseModel):
    minutes: int = Field(25, ge=1, le=180)
    label: str = ""
    kind: str = "focus"


class DistractBody(BaseModel):
    reason: str = Field(..., min_length=1)
    category: str = "other"
    notes: str = ""


class FinishBody(BaseModel):
    notes: str = ""


def create_app(db_path: Path | None = None) -> FastAPI:
    db = Database(db_path)

    app = FastAPI(title="Focus Log", version=__version__)
    app.mount("/static", StaticFiles(directory=str(PACKAGE_DIR / "static")), name="static")

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request) -> HTMLResponse:
        return TEMPLATES.TemplateResponse(
            request,
            "index.html",
            {
                "format_duration": format_duration,
                "category_label": category_label,
                "product": product_copy(),
            },
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    @app.get("/api/overview")
    def overview() -> dict[str, Any]:
        return db.overview()

    @app.get("/api/report")
    def report(weeks_ago: int = 0) -> dict[str, Any]:
        return db.weekly_report(weeks_ago=max(0, weeks_ago))

    @app.get("/api/session/active")
    def active_session() -> dict[str, Any]:
        return {"session": db.get_active_session()}

    @app.post("/api/session/start")
    def start_session(body: StartBody) -> dict[str, Any]:
        try:
            session = db.start_session(
                kind=body.kind if body.kind in {"focus", "break"} else "focus",
                label=body.label,
                planned_minutes=body.minutes,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return {"session": session}

    @app.post("/api/session/done")
    def done_session(body: FinishBody) -> dict[str, Any]:
        try:
            session = db.finish_session(status="completed", notes=body.notes)
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return {"session": session}

    @app.post("/api/session/abort")
    def abort_session(body: FinishBody) -> dict[str, Any]:
        try:
            session = db.finish_session(status="aborted", notes=body.notes)
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return {"session": session}

    @app.post("/api/distract")
    def distract(body: DistractBody) -> dict[str, Any]:
        try:
            row = db.log_distraction(
                body.reason, category=body.category, notes=body.notes
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"distraction": row}

    @app.post("/api/seed")
    def seed() -> dict[str, str]:
        db.seed_demo()
        return {"status": "ok"}

    return app


def run(host: str | None = None, port: int | None = None, db_path: Optional[Path] = None) -> None:
    import uvicorn

    bind_host = host or os.environ.get("HOST", "0.0.0.0")
    bind_port = port or int(os.environ.get("PORT", "8765"))
    uvicorn.run(create_app(db_path=db_path), host=bind_host, port=bind_port)

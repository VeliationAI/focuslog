"""Focus Log command-line interface."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

from focuslog import __version__
from focuslog.analytics import category_label, format_duration, summarize_week
from focuslog.db import Database, export_json, parse_iso, utcnow

app = typer.Typer(
    name="focuslog",
    help="Pomodoro timer + distraction log with weekly analytics.",
    no_args_is_help=True,
    add_completion=False,
)
console = Console()

CATEGORIES = [
    "chat",
    "social",
    "email",
    "phone",
    "web",
    "meetings",
    "people",
    "environment",
    "other",
]


def get_db(db_path: Optional[Path] = None) -> Database:
    return Database(db_path)


def _session_panel(session: dict, remaining: int | None = None) -> Panel:
    started = parse_iso(session["started_at"])
    elapsed = int((utcnow() - started).total_seconds())
    planned = int(session["planned_minutes"]) * 60
    left = max(0, planned - elapsed) if remaining is None else max(0, remaining)
    label = session["label"] or session["kind"].title()
    kind = session["kind"].upper()
    body = Text()
    body.append(f"{kind}  ", style="bold #3DDC97")
    body.append(label + "\n", style="bold white")
    body.append(f"Elapsed  {format_duration(elapsed)}", style="dim")
    body.append("   ·   ", style="dim")
    body.append(f"Left  {format_duration(left)}", style="#C4A574")
    body.append("\n")
    body.append(f"Planned {session['planned_minutes']} min  ·  Session #{session['id']}")
    return Panel(
        body,
        title="[bold]FOCUS LOG[/]",
        subtitle="press Ctrl+C to pause menu",
        border_style="#3DDC97",
        padding=(1, 2),
    )


@app.command()
def start(
    minutes: int = typer.Option(25, "--minutes", "-m", help="Focus length in minutes."),
    label: str = typer.Option("", "--label", "-l", help="What you're working on."),
    break_: bool = typer.Option(False, "--break", help="Start a break instead of focus."),
    tick: bool = typer.Option(True, "--tick/--no-tick", help="Live countdown in the terminal."),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Start a Pomodoro focus (or break) session."""
    db = get_db(db_path)
    kind = "break" if break_ else "focus"
    if break_ and minutes == 25:
        minutes = 5
    try:
        session = db.start_session(kind=kind, label=label, planned_minutes=minutes)
    except RuntimeError as exc:
        console.print(f"[red]{exc}[/]")
        raise typer.Exit(1) from exc

    console.print(
        f"[bold #3DDC97]Started[/] {kind} session #{session['id']} — "
        f"{minutes} min" + (f" · {label}" if label else "")
    )
    console.print(
        "[dim]Log a distraction anytime with[/] [bold]focuslog distract \"reason\"[/]"
    )

    if not tick:
        return

    planned = minutes * 60
    try:
        with Live(console=console, refresh_per_second=4) as live:
            while True:
                started = parse_iso(session["started_at"])
                elapsed = int((utcnow() - started).total_seconds())
                left = planned - elapsed
                live.update(_session_panel(session, remaining=left))
                if left <= 0:
                    break
                time.sleep(0.25)
        finished = db.finish_session(session["id"], status="completed")
        console.print(
            Panel(
                f"[bold #3DDC97]Session complete[/]\n"
                f"Focused {format_duration(finished['focus_seconds'])}",
                border_style="#3DDC97",
            )
        )
    except KeyboardInterrupt:
        console.print()
        action = Prompt.ask(
            "Session interrupted",
            choices=["complete", "abort", "keep"],
            default="keep",
        )
        if action == "complete":
            finished = db.finish_session(session["id"], status="completed")
            console.print(f"[green]Completed[/] · {format_duration(finished['focus_seconds'])}")
        elif action == "abort":
            finished = db.finish_session(session["id"], status="aborted")
            console.print(f"[yellow]Aborted[/] · {format_duration(finished['focus_seconds'])}")
        else:
            console.print(
                "[dim]Session still active. Use[/] focuslog status / done / abort"
            )


@app.command()
def distract(
    reason: str = typer.Argument(..., help="What pulled your attention away."),
    category: str = typer.Option(
        "other",
        "--category",
        "-c",
        help=f"One of: {', '.join(CATEGORIES)}",
    ),
    notes: str = typer.Option("", "--notes", "-n"),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Log a distraction — the heart of Focus Log analytics."""
    db = get_db(db_path)
    if category not in CATEGORIES:
        console.print(f"[yellow]Unknown category[/] — storing as '{category}'.")
    row = db.log_distraction(reason, category=category, notes=notes)
    active = db.get_active_session()
    link = f" · session #{active['id']}" if active else " · no active session"
    console.print(
        f"[bold #FF6B4A]Logged distraction[/] — {reason} "
        f"[dim]({category_label(row['category'])}){link}[/]"
    )


@app.command("done")
def done(
    notes: str = typer.Option("", "--notes", "-n"),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Mark the active session as completed."""
    db = get_db(db_path)
    try:
        session = db.finish_session(status="completed", notes=notes)
    except RuntimeError as exc:
        console.print(f"[red]{exc}[/]")
        raise typer.Exit(1) from exc
    console.print(
        f"[bold #3DDC97]Completed[/] session #{session['id']} · "
        f"{format_duration(session['focus_seconds'])}"
    )


@app.command()
def abort(
    notes: str = typer.Option("", "--notes", "-n"),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Abort the active session."""
    db = get_db(db_path)
    try:
        session = db.finish_session(status="aborted", notes=notes)
    except RuntimeError as exc:
        console.print(f"[red]{exc}[/]")
        raise typer.Exit(1) from exc
    console.print(
        f"[yellow]Aborted[/] session #{session['id']} · "
        f"{format_duration(session['focus_seconds'])}"
    )


@app.command()
def status(
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Show the active session and today's quick pulse."""
    db = get_db(db_path)
    active = db.get_active_session()
    week = db.weekly_report(weeks_ago=0)
    if active:
        console.print(_session_panel(active))
    else:
        console.print("[dim]No active session.[/] Start one with [bold]focuslog start[/]")

    t = week["totals"]
    console.print(
        f"This week · focus {format_duration(t['focus_seconds'])} · "
        f"{t['completed']}/{t['sessions']} done · "
        f"{t['distractions']} distractions"
    )


@app.command()
def report(
    weeks_ago: int = typer.Option(0, "--weeks-ago", "-w", help="0 = current week."),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Weekly analytics — top distractions and focus quality."""
    db = get_db(db_path)
    data = db.weekly_report(weeks_ago=weeks_ago)
    t = data["totals"]

    header = Text()
    header.append("FOCUS LOG", style="bold #3DDC97")
    header.append("  ·  Weekly Report\n", style="bold white")
    for line in summarize_week(data):
        header.append(line + "\n", style="dim")

    console.print(Panel(header, border_style="#C4A574", padding=(1, 2)))

    metrics = Table(show_header=False, box=None, padding=(0, 2))
    metrics.add_row(
        f"[bold]{format_duration(t['focus_seconds'])}[/]\n[dim]focus time[/]",
        f"[bold]{t['completion_rate']}%[/]\n[dim]completion[/]",
        f"[bold]{t['distractions']}[/]\n[dim]distractions[/]",
        f"[bold]{t['distractions_per_session']}[/]\n[dim]per session[/]",
    )
    console.print(metrics)
    console.print()

    cat_table = Table(title="Top distraction categories", title_style="bold #FF6B4A")
    cat_table.add_column("Category")
    cat_table.add_column("Count", justify="right")
    cat_table.add_column("Share", justify="right")
    total_d = max(t["distractions"], 1)
    for row in data["top_categories"]:
        share = round(100 * row["count"] / total_d, 1)
        cat_table.add_row(category_label(row["category"]), str(row["count"]), f"{share}%")
    if data["top_categories"]:
        console.print(cat_table)
    else:
        console.print("[dim]No distractions logged this week. Strong focus.[/]")

    reason_table = Table(title="Most common pulls", title_style="bold white")
    reason_table.add_column("Reason")
    reason_table.add_column("Category")
    reason_table.add_column("×", justify="right")
    for row in data["top_reasons"]:
        reason_table.add_row(
            row["reason"],
            category_label(row["category"]),
            str(row["count"]),
        )
    if data["top_reasons"]:
        console.print(reason_table)

    day_table = Table(title="Daily rhythm", title_style="dim")
    day_table.add_column("Day")
    day_table.add_column("Focus", justify="right")
    day_table.add_column("Sessions", justify="right")
    day_table.add_column("Distractions", justify="right")
    for day in data["day_series"]:
        day_table.add_row(
            day["weekday"],
            format_duration(day["focus_seconds"]),
            f"{day['completed']}/{day['sessions']}",
            str(day["distractions"]),
        )
    console.print(day_table)


@app.command("log")
def show_log(
    days: int = typer.Option(7, "--days", "-d"),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """List recent distractions."""
    db = get_db(db_path)
    rows = db.list_distractions(days=days, limit=50)
    table = Table(title=f"Distractions · last {days}d")
    table.add_column("When")
    table.add_column("Reason")
    table.add_column("Category")
    table.add_column("Session")
    for row in rows:
        when = parse_iso(row["logged_at"]).strftime("%a %H:%M")
        table.add_row(
            when,
            row["reason"],
            category_label(row["category"]),
            str(row["session_id"] or "—"),
        )
    if not rows:
        console.print("[dim]No distractions yet.[/]")
        return
    console.print(table)


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", "--host"),
    port: int = typer.Option(8765, "--port", "-p"),
    seed: bool = typer.Option(False, "--seed", help="Load demo data if DB is empty."),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Launch the Focus Log product dashboard."""
    import os

    import uvicorn

    from focuslog.server import create_app

    db = get_db(db_path)
    if seed:
        db.seed_demo()
        console.print("[dim]Demo data ready (skipped if DB already had sessions).[/]")

    bind_host = host or os.environ.get("HOST", "127.0.0.1")
    bind_port = int(os.environ.get("PORT", port))
    display = "127.0.0.1" if bind_host in {"0.0.0.0", "::"} else bind_host
    console.print(
        Panel(
            f"[bold #3DDC97]Focus Log[/] product\n"
            f"http://{display}:{bind_port}\n\n"
            f"[dim]Data · {db.path}[/]",
            border_style="#3DDC97",
        )
    )
    uvicorn.run(create_app(db_path=db.path), host=bind_host, port=bind_port, log_level="info")


@app.command()
def export(
    days: int = typer.Option(30, "--days", "-d"),
    out: Optional[Path] = typer.Option(None, "--out", "-o"),
    db_path: Optional[Path] = typer.Option(None, "--db", hidden=True),
) -> None:
    """Export sessions + distractions as JSON."""
    db = get_db(db_path)
    payload = export_json(db, days=days)
    if out:
        out.write_text(payload, encoding="utf-8")
        console.print(f"[green]Wrote[/] {out}")
    else:
        console.print(payload)


@app.command()
def version() -> None:
    """Print version."""
    console.print(f"focuslog {__version__}")


@app.callback()
def main() -> None:
    """Focus Log — know what steals your attention."""


if __name__ == "__main__":
    app()

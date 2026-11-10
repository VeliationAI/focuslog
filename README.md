# Focus Log

**Know what steals your attention.**

Timers count minutes. Focus Log ranks interruptions — so you can change the environment, not just the willpower.

## Product loop

1. **Protect a block** — start a Pomodoro (CLI or web)
2. **Log the pull** — when focus breaks, name what stole it
3. **Read the week** — top distractions, categories, daily rhythm, coaching insight

## Quick start

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
pip install -e .
```

### Web product

```bash
focuslog serve --seed
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

### CLI

```bash
focuslog start -m 25 -l "Deep work"
focuslog distract "Slack ping" -c chat
focuslog done
focuslog report
focuslog status
```

## What’s inside

| Surface | Role |
|---------|------|
| Timer | Focus / break sessions with live countdown |
| Distraction log | Reason + category, one-tap chips on web |
| Weekly coach | Insight from your #1 distraction category |
| Analytics | Completion, focus time, pulls/session, daily bars |
| Streak | Consecutive days with a completed focus block |

Data is local-first SQLite (`~/.focuslog/focuslog.db` by default).

## Deploy (Render)

`render.yaml` is included. Blueprint deploy:

1. Open [Render Blueprint](https://dashboard.render.com/blueprints/new)
2. Connect `VeliationAI/focuslog`
3. Apply — persistent disk keeps the SQLite ledger across restarts

Or from CLI after Render login:

```bash
# uses render.yaml in repo root
```

## Repo

https://github.com/VeliationAI/focuslog

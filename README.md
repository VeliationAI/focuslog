# Focus Log

**Know what steals your attention.**

Timers count minutes. Focus Log ranks interruptions — so you can change the environment, not just the willpower.

Open-source · MIT · built by [Veliation AI](https://github.com/VeliationAI).

[![Live Demo](https://img.shields.io/badge/Live%20Demo-onrender-3DDC97?style=flat-square)](https://focuslog-xu9t.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![CI](https://github.com/VeliationAI/focuslog/actions/workflows/ci.yml/badge.svg)](https://github.com/VeliationAI/focuslog/actions/workflows/ci.yml)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-3776AB?style=flat-square)](https://www.python.org/downloads/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

## Live demo

**https://focuslog-xu9t.onrender.com**

No install. Start a focus block, log distractions, read the weekly coach.  
Free Render instances may sleep after idle (~30s cold start). Demo data seeds when the DB is empty.

## Why this exists

Pomodoro apps count minutes. The useful residue is different:

- what **pulled** you away
- which **category** wins the week
- whether you’re actually **completing** blocks

Focus Log turns interruptions into a ledger you can act on.

## Features

- **Timer** — focus + break sessions (CLI and web)
- **Distraction log** — reason + category, one-tap chips, `/` shortcut
- **Weekly coach** — insight from your #1 distraction category
- **Analytics** — completion, focus time, pulls/session, daily rhythm
- **Streaks** — consecutive days with a completed focus block
- **Local-first** — SQLite at `~/.focuslog/focuslog.db`
- **Export** — JSON dump of sessions + distractions

## Quick start

```bash
git clone https://github.com/VeliationAI/focuslog.git
cd focuslog
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

### Web

```bash
focuslog serve --seed
# → http://127.0.0.1:8765
```

### CLI

```bash
focuslog start -m 25 -l "Deep work"
focuslog distract "Slack ping" -c chat
focuslog done
focuslog report
```

## Configuration

See [`.env.example`](.env.example):

| Variable | Purpose |
|----------|---------|
| `FOCUSLOG_DB` | SQLite path |
| `FOCUSLOG_SEED` | `1` seeds demo data when empty |
| `PORT` / `HOST` | Web bind (Render sets `PORT`) |

## Deploy your own

Fork + [Render Blueprint](https://dashboard.render.com/blueprint/new?repo=https://github.com/VeliationAI/focuslog), or:

```bash
uvicorn focuslog.app:app --host 0.0.0.0 --port $PORT
```

## Contributing

PRs welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).  
Security: [SECURITY.md](SECURITY.md) · Changes: [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 [Veliation AI](https://github.com/VeliationAI)

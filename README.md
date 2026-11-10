# Focus Log

Pomodoro timer **plus** a distraction ledger. Every time attention breaks, you log what pulled you away. The weekly report shows your top distractions — that’s the product.

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

### CLI

```bash
focuslog start -m 25 -l "Deep work"
focuslog distract "Slack ping" -c chat
focuslog done
focuslog report
focuslog status
focuslog log
```

### Web dashboard

```bash
focuslog serve --seed
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

`--seed` loads a demo week only when the database is empty.

## Why it’s different

Most timers track minutes. Focus Log tracks **interruptions** — categorized, counted, ranked weekly — so you can change the environment, not just the willpower.

| Command | What it does |
|---------|----------------|
| `start` | Begin focus (or `--break`) with a live countdown |
| `distract` | Log what broke focus (category + reason) |
| `done` / `abort` | Close the active session |
| `report` | Weekly analytics: top categories, common pulls, daily rhythm |
| `serve` | Tiny local dashboard (timer + analytics) |

Data lives in `~/.focuslog/focuslog.db` (SQLite).

# Minutes to Actions

**Paste a meeting transcript. Walk out with decisions, action items, and who owns what.**

Everyone takes notes. Nobody extracts the actions. This does.

Built by [Veliation AI](https://github.com/VeliationAI).

[![Live Demo](https://img.shields.io/badge/Live%20Demo-minutes--to--actions.onrender.com-E8A838?style=flat-square)](https://minutes-to-actions.onrender.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-amber.svg)](https://www.python.org/downloads/)

## Live app

**Try it now (public):** [https://minutes-to-actions.onrender.com](https://minutes-to-actions.onrender.com/)

Hosted on [Render](https://render.com). No install required — paste a transcript and extract actions. Free instances may sleep after idle; the first load can take ~30s.

## Product loop

1. **Paste** — Zoom / Meet / Teams transcript or speaker notes
2. **Extract** — LLM (or offline heuristics) finds decisions, owners, dues, open questions
3. **Ship** — Copy markdown or JSON into Slack, Notion, Linear, email

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

### Demo (no API key required)

```bash
minutes demo
```

### CLI

```bash
minutes extract -f notes.txt
minutes extract -f notes.txt -F markdown -o actions.md
minutes extract -f notes.txt -F json
cat notes.txt | minutes extract --heuristic
```

### Web product

```bash
minutes serve
```

Open [http://127.0.0.1:8766](http://127.0.0.1:8766) → **Load sample** → **Extract actions**.

## LLM mode

```bash
# Windows PowerShell
$env:OPENAI_API_KEY = "sk-..."

# macOS / Linux
export OPENAI_API_KEY=sk-...
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` / `MINUTES_API_KEY` | — | API auth |
| `MINUTES_MODEL` | `gpt-4o-mini` | Chat model |
| `MINUTES_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible gateway |

No key? Offline heuristics still run — demos never break.

## What you get

| Output | Description |
|--------|-------------|
| **Decisions** | Commitments already made |
| **Action items** | Task + owner + due + priority |
| **Open questions** | Unresolved asks |
| **Attendees** | Speakers / listed participants |
| **Export** | Markdown checklist or JSON |

## Deploy on Render

`render.yaml` is included. Start command:

```bash
uvicorn minutes.server:create_app --factory --host 0.0.0.0 --port $PORT
```

## License

MIT — see [LICENSE](LICENSE).

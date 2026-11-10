# Contributing to Focus Log

Thanks for helping people notice what steals their attention.

## Ways to contribute

- **Bugs** — open an issue with steps, expected vs actual, OS, and CLI vs web
- **Features** — open an issue first for non-trivial ideas
- **Docs** — clearer quick starts, screenshots, translations
- **Analytics** — better weekly insights, categories, visualizations
- **UI/UX** — keep the product loop simple: protect → log → review

## Development setup

```bash
git clone https://github.com/VeliationAI/focuslog.git
cd focuslog
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pip install -e ".[dev]"
```

Smoke checks:

```bash
focuslog version
focuslog start -m 1 -l "Smoke" --no-tick
focuslog distract "Test pull" -c chat
focuslog done
focuslog report
focuslog serve --seed   # http://127.0.0.1:8765
```

## Pull request guidelines

1. Keep PRs focused — one idea per PR when possible
2. Match existing style (night-desk UI, typed Python, local-first data)
3. Don’t commit secrets, `.venv/`, or personal `*.db` files
4. Update `CHANGELOG.md` under **Unreleased** for user-facing changes
5. Link related issues

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions

Open a [GitHub Discussion/Issue](https://github.com/VeliationAI/focuslog/issues) — maintainers watch the tracker.

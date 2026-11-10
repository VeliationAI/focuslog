# Changelog

All notable changes to Focus Log are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Open-source project docs: contributing guide, code of conduct, security policy, changelog
- GitHub issue and pull request templates

### Changed

- Dashboard UX pass: one-screen hero with timer, 15/25/50 presets and a single "Start focus block" CTA
- "Got pulled away?" card sits next to the timer: one-tap chips, Enter-to-log, auto-categorising
- Calmer "This week" view: three headline numbers, top pulls, by-day chart; extra detail folded away
- First-run empty states, loop progress indicator, live countdown in the tab title, mobile and accessibility fixes

## [1.1.0] — 2026-11-10

### Added

- Weekly coaching insights from top distraction categories
- Streak + all-time focus pulse on the web dashboard
- Product loop UI, quick-log chips, keyboard shortcut `/`
- Production ASGI entry (`focuslog.app:app`) and Render blueprint
- Public live demo on Render

## [1.0.0] — 2026-11-09

### Added

- Initial CLI: `start`, `distract`, `done`, `abort`, `status`, `report`, `log`, `serve`, `export`
- FastAPI dashboard with timer + weekly analytics
- SQLite local ledger for sessions and distractions

[Unreleased]: https://github.com/VeliationAI/focuslog/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/VeliationAI/focuslog/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/VeliationAI/focuslog/releases/tag/v1.0.0

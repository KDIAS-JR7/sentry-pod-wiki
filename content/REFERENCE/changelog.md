# Changelog

Project evolution from the `docs/` session history.

## Phase 1 — Consolidation

- Merged `command-center/` into `frontend/` (~80 duplicate files removed)
- Removed malformed `xx.yml` playbook and catalog entry
- Updated podman-compose to use `frontend/Dockerfile.prod` for command-center service
- Cherry-picked: SessionSidebar double-click delete UX, removed alert() in AiChat

## Phase 2 — Refactor (2026-06-21)

- Split `network_routes.py` into 3 files: `device_routes.py`, `terminal_routes.py`, `network_utils.py`
- Split `playbook_service.py` into 3 services: `catalog_service.py`, `drift_service.py`, `playbook_service.py`
- Fixed auth stubs across all routes
- Eliminated dead code (~2000 LOC reduction)
- Replaced hardcoded API URLs with `import.meta.env.VITE_API_BASE_URL` across all frontend files

## Audit fixes

- Added `eslint-plugin-react` to `frontend/package.json` (was breaking `npm run lint`)
- Renamed `DATABASE_URL` → `MONGO_URI` in compose (mismatch with `database.py`)
- Changed DB name from `sentry_nms` → `sentry_pod_db` to match the code
- Fixed 22 hardcoded API URLs across frontend
- Fixed `ApiKeyModal.jsx` literal string bug (`'${API_BASE}'` → `'http://localhost:8000'`)

## Documentation sessions

- `AUTH_SETUP.md` — Auth build fixes, CORS, DB alignment, SSH ciphers
- `CDP_TOPOLOGY_MAP.md` — CDP neighbor discovery, BFS tier auto-discovery, React Flow
- `CONFIG_DRIFT_AUTOMATION.md` — Drift detection pipeline implementation
- `CONTAINER_MANAGEMENT.md` — container_manager.py CLI documentation
- `FRONTEND_SYNC.md` — frontend/src → command-center/src sync (now deprecated after merge)
- `HEALTH_CHECK.md` — Audit findings and smoke_test.py creation
- `IMPLEMENTATION_SUMMARY.md` — Git-style diff viewer implementation
- `MIGRATION_GUIDE.md` — Host → containerized Ansible migration
- `NETWORK_BASELINE_AUTOMATION.md` — SNMP baseline pipeline
- `ONBOARDING_WORKFLOW.md` — 5-step setup wizard
- `PLAYBOOK_MODIFICATION.md` — AI-driven playbook modification
- `REAL_TIME_NETWORK_STATUS.md` — 4-tier cascading status algorithm
- `REFRESH_FACTS.md` — One-time fact refresh with SSE progress
- `SESSION_MEMORY.md` — Chat session persistence
- `SYSLOG_INTELLIGENCE.md` — Syslog pipeline
- `terminal-customization.md` — xterm.js themes and settings

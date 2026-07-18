# Watchman (FastAPI Backend)

## Overview

Watchman is the main API backend. FastAPI application with async MongoDB (motor), JWT auth, playbook orchestration via Podman.

## Entry point

**File:** `watchman/app/main.py` (49 lines)

- `:16` — `app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)`
- `:18-24` — CORS middleware from `config.py:46-50` origins
- `:26-31` — Global exception handler → `{"detail": "Internal server error", "code": "INTERNAL_ERROR"}`
- `:33-45` — Includes 12 route modules
- `:47-49` — Root `GET /` → `{"message": "Sentry-Pod API is live"}`

## Configuration

**File:** `watchman/app/core/config.py` (59 lines)

| Field | Type | Default | Source |
|---|---|---|---|
| `PROJECT_NAME` | str | `"Sentry-Pod Watchman"` | — |
| `VERSION` | str | `"1.0.0"` | — |
| `DB_USER` | str | required | .env |
| `DB_PASS` | str | required | .env |
| `DB_HOST` | str | required | .env |
| `MONGO_URI` | computed | `mongodb+srv://{user}:{pass}@{host}/{db}` | computed from above |
| `SECRET_KEY` | str | required | .env |
| `ALGORITHM` | str | `"HS256"` | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | 120 | — |
| `BACKEND_CORS_ORIGINS` | list | localhost:5173/5174/3000 | — |

Loaded via `pydantic-settings` from `watchman/.env` (`:52-56`).

## Database

**File:** `watchman/app/database.py` (55 lines)

| Collection | Variable | Line | Index |
|---|---|---|---|
| `devices` | `devices_collection` | 22 | `name` (unique), `ip` |
| `logs` | `logs_collection` | 23 | `timestamp`, `username`, `action_name` |
| `device_configurations` | `device_configurations_collection` | 24 | `device_id` (unique) |
| `api_keys` | `api_keys_collection` | 25 | — |
| `playbooks` | `playbooks_collection` | 26 | `name` |
| `conversations` | `conversations_collection` | 27 | `updated_at` |
| `syslog_alerts` | `syslog_alerts_collection` | 28 | `timestamp` |
| `users` | `users_collection` | 29 | `username` (unique), `email` (unique) |

MongoDB URI resolved in `:13`: env var `MONGO_URI` → `settings.MONGO_URI` fallback.

## Routes (12 modules)

| Route file | Prefix | Tags | Key endpoints |
|---|---|---|---|
| `user_routes.py` | — | Users | CRUD users, admin-only |
| `auth_routes.py` | — | Authentication | `POST /login` |
| `playbook_routes.py` | `/playbooks` | Playbooks | execute, stream, list, catalog, drift, baseline, modify, dashboard |
| `audit_routes.py` | — | Audit | CRUD audit logs |
| `llm_routes.py` | `/llm` | LLM | chat, sessions, API key mgmt |
| `telemetry_routes.py` | `/api/network` | Network Telemetry | traffic-history, telemetry-hosts |
| `device_routes.py` | `/api/network` | Network Devices | devices, active-devices, device-status, scan |
| `terminal_routes.py` | — | Terminal | SSH WebSocket terminal |
| `syslog_routes.py` | `/api/syslog` | Syslog | GET/POST/DELETE alerts |
| `topology_routes.py` | `/api/topology` | Topology | graph, refresh, refresh-stream |
| `setup_routes.py` | `/setup` | Setup | status, preview, apply, init |
| `console_routes.py` | — | Console | PTY WebSocket container shell |

## Services (7 modules)

| Service file | Lines | Role |
|---|---|---|
| `auth_service.py` | 35 | Login authentication, JWT creation |
| `catalog_service.py` | 243 | Playbook catalog JSON CRUD, suggestion scoring, inventory parsing |
| `drift_service.py` | 75 | Parse drift diffs, read single file, list baselines |
| `execution_service.py` | 164 | Podman command building, playbook execution, SSE streaming |
| `playbook_service.py` | — | LLM-driven playbook modification |
| `setup_service.py` | 462 | Onboarding wizard: INI rendering, diff, report, flush |
| `topology_service.py` | 342 | CDP parser, BFS tier discovery, graph builder, MongoDB storage |
| `user_service.py` | — | User CRUD business logic |

## Models (4 modules)

| Model file | Schemas |
|---|---|
| `playbook.py` | PlaybookRequest/Response, CatalogItem, Suggestion, ModifyPropose/Approve |
| `setup.py` | DeviceEntry, GlobalCreds, SetupPreview/Apply/Status/Diff |
| `syslog.py` | SyslogAlert, SyslogAlertCreate |
| `user.py` | UserCreate/Response/Login/Profile/Password, Token, UserRoleUpdate |
| `telemetry.py` | TrafficDataPoint, NetworkDevice, NetworkDeviceCreate |

## Core utilities

| File | Lines | Role |
|---|---|---|
| `config.py` | 59 | Pydantic Settings from .env |
| `dependencies.py` | 36 | `get_current_user()`, `require_super_admin()` |
| `security.py` | 41 | JWT create/verify, bcrypt password hash |

## Docker

**File:** `watchman/Dockerfile` (20 lines)

- `:2` — Base: `python:3.11-slim`
- `:6` — Installs: `nmap`, `podman`
- `:7-9` — Configures Podman VFS storage driver
- `:12` — `pip install -r requirements.txt`
- `:15-16` — Copies + chmods `entrypoint.sh`
- `:20` — Entrypoint: `entrypoint.sh` (loads sentry-ansible image, starts uvicorn)

**File:** `watchman/scripts/entrypoint.sh` (26 lines)

- `:5-8` — Cleans stale Podman storage after host reboot
- `:10-24` — Loads `sentry-ansible.tar` if image not present
- `:26` — `exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --limit-concurrency 100`

# Architecture

## Overview

Sentry-Pod runs as four long-lived Podman containers (defined in `podman-compose.yaml`) plus one ephemeral Ansible runner container. The primary data store is MongoDB Atlas; a local `vault` container is available for offline dev but not used by default.

## Container topology

```
┌──────────────────────────────────────────────────────────────────┐
│                        Host / Podman host                        │
│   ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│   │command-center│    │    watchman      │    │    vault      │  │
│   │:80 → 3000    │◀──▶│ :8000            │◀──▶│ :27017        │  │
│   │nginx + React │    │FastAPI + motor   │    │ MongoDB (opt) │  │
│   │prod build    │    │ 12 routes        │    │               │  │
│   └──────────────┘    └────────┬─────────┘    └───────────────┘  │
│                               │                                  │
│                               │ podman exec (via execution_svc)  │
│                               ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐                    │
│  │  sentry-ansible  │    │   syslog-ng      │                    │
│  │  (ephemeral)     │    │   :10514/udp     │                    │
│  │  Ansible runner  │    │   syslog capturer│                    │
│  │  cisco.ios coll. │    │   + listener sh  │                    │
│  └──────────────────┘    └──────────────────┘                    │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │
│  External:                                                       │
│  ┌──────────────┐    ┌─────────────────────┐                     │
│  │  Browser     │    │  MongoDB Atlas       │                    │
│  │  :5173 (dev) │    │  sentrypod.xxxxx.mongodb.net              │
│  │  :3000 (prod)│    │  sentry_pod_db        │                   │
│  └──────────────┘    └─────────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

## Services table

| Service | Image source | Container name | Port | Purpose |
|---|---|---|---|---|
| `vault` | `mongo:latest` | `sentry-pod_vault_1` | 27017 | Local MongoDB (unused by default, see [COMPONENTS/vault.md](COMPONENTS/vault.md)) |
| `watchman` | `./watchman/Dockerfile:1-20` | auto | 8000 | FastAPI backend — all API logic, JWT auth, playbook orchestration |
| `syslog-ng` | `./watchman/Dockerfile.syslog-ng:1-15` | `sentry-pod_syslog-ng_1` | 10514/udp | Centralized syslog capture via syslog-ng |
| `command-center` | `./frontend/Dockerfile.prod:1-12` | auto | 3000:80 | React production build served by nginx |
| `sentry-ansible` | `./watchman/Dockerfile.ansible` (via `container_manager.py`) | `sentry-ansible` | — | Ephemeral Ansible runner (created per playbook execution) |

## Data flow summary

### Read path (UI loads data)

```
Browser ──GET /api/*──▶ watchman ──motor──▶ MongoDB Atlas ──response──▶ watchman ──JSON──▶ Browser
```

### Write path (playbook execution)

```
Browser ──POST /playbooks/execute──▶ watchman
    ──podman exec sentry-ansible──▶ ansible-playbook playbook.yml
    ──stdout──▶ watchman parses output
    ──SSE stream──▶ Browser (real-time progress)
    ──results stored──▶ MongoDB
```

### Syslog ingestion path

```
Cisco device ──udp/10514──▶ syslog-ng container
    ──/var/log/syslog──▶ syslog_listener.sh (periodic poll + POST)
    ──POST /api/syslog/alerts──▶ watchman
    ──MongoDB syslog_alerts──▶ Browser polls GET /api/syslog/alerts
```

## Codebase layout (key paths)

| Path | Role |
|---|---|
| `watchman/app/main.py:1-49` | FastAPI entry point, CORS, 12 router includes |
| `watchman/app/database.py:1-55` | Motor client, 8 collections, index creation |
| `watchman/app/core/config.py:1-59` | Pydantic Settings (DB, JWT, CORS) |
| `watchman/app/routes/` | 12 route modules (one per feature area) |
| `watchman/app/services/` | 7 service modules (business logic) |
| `watchman/playbooks/catalog.json` | 19 catalog entries driving suggestion engine |
| `watchman/playbooks/*.yml` | 22 Ansible playbooks |
| `watchman/scripts/container_manager.py` | Unified CLI for sentry-ansible lifecycle |
| `frontend/src/App.jsx:29-68` | React Router table — 16 routes total |
| `frontend/src/pages/` | 17 page components |
| `frontend/src/components/` | 30+ reusable components |
| `frontend/src/services/` | 11 API service modules (axios) |
| `podman-compose.yaml:1-51` | 4-service compose definition |
| `frontend/Dockerfile.prod:1-12` | Multi-stage build (node build → nginx serve) |
| `watchman/Dockerfile:1-20` | Python 3.11 + nmap + podman + FastAPI |

## Authentication flow (minimal)

```
1. User sends POST /api/auth/login with username + password
2. auth_routes.py validates credentials against MongoDB users collection
3. JWT created with HS256, expires after 120 min (config.py:39-41)
4. Token returned in response body
5. Frontend stores in localStorage, sends as Authorization: Bearer <token>
6. All protected routes use get_current_user dependency (core/dependencies.py)
7. 401 forces redirect to /login on frontend
```

See [FLOWS/authentication-flow.md](FLOWS/authentication-flow.md) for full detail.

## MongoDB

**Default:** Uses MongoDB Atlas (`sentrypod.n5boezy.mongodb.net`) — URI constructed in `config.py:26-34` from `DB_USER`, `DB_PASS`, `DB_HOST` env vars.

**Collections** (defined in `database.py:22-29`):
- `devices` — network device inventory
- `logs` — audit trail
- `device_configurations` — config snapshots for drift
- `api_keys` — HuggingFace API key storage
- `playbooks` — playbook execution records
- `conversations` — AI chat sessions
- `syslog_alerts` — ingested syslog messages
- `users` — user accounts (RBAC)

**To switch to local vault:** replace `MONGO_URI` in compose environment, see [COMPONENTS/vault.md](COMPONENTS/vault.md).

## Ansible execution model

Playbooks never run on the host. The `execution_service.py` module:
1. Calls `podman exec` into the `sentry-ansible` container
2. Mounts the playbook directory and inventory
3. Streams stdout back via SSE
4. Cleans up output after completion

Key quirks documented in [COMPONENTS/ansible.md](COMPONENTS/ansible.md):
- `host_key_checking = False` in `ansible.cfg`
- Legacy SSH ciphers (diffie-hellman-group1-sha1, ssh-rsa) enabled
- Container includes `cisco.ios` Ansible collection

## Env vars

Loaded from `watchman/.env` (mounted at `/app/.env` inside container):

| Var | Used in | Purpose |
|---|---|---|
| `DB_USER` | `config.py:19` | MongoDB Atlas username |
| `DB_PASS` | `config.py:20` | MongoDB Atlas password |
| `DB_HOST` | `config.py:21` | MongoDB Atlas hostname |
| `SECRET_KEY` | `config.py:39` | JWT signing secret |
| `HUGGINGFACE_API_KEY` | `llm_routes.py` | HuggingFace Router API token |

## Frontend routing

| Path | Component | Notes |
|---|---|---|
| `/` | `Home.jsx` | Public landing |
| `/login` | `Login.jsx` | PublicRoute — redirects if authed |
| `/setup` | `SetupWizard.jsx` | Protected, no sidebar |
| `/dashboard` | `Dashboard.jsx` | Protected, sidebar |
| `/topology` | `TopologyMap.jsx` | Protected, sidebar |
| `/ai-chat` | `AiChat.jsx` | Protected, sidebar |
| `/staging` | `StagingGate.jsx` | Protected, sidebar |
| `/network-devices` | `NetworkDevices.jsx` | Protected, sidebar |
| `/audit-logs` | `AuditLogs.jsx` | Protected, sidebar |
| `/users` | `RBACUsers.jsx` | Protected, sidebar |
| `/profile` | `Profile.jsx` | Protected, sidebar |
| `/settings` | `SettingsPage.jsx` | Protected, sidebar |
| `/playbooks` | `PlaybookManagement.jsx` | Protected, sidebar |
| `/drift-reports` | `DriftReports.jsx` | Protected, sidebar |
| `/drift-reports/:hostname` | `DriftReportDetail.jsx` | Protected, sidebar |
| `/console` | `Console.jsx` | Protected, sidebar |

See [COMPONENTS/frontend.md](COMPONENTS/frontend.md) for component tree.

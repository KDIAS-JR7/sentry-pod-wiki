# Syslog Pipeline

## Diagram

```
┌──────────────┐     UDP :10514     ┌──────────────────────────────┐
│ Cisco device │ ──────────────────▶│      syslog-ng container     │
│ (router/sw)  │                    │  syslog-ng daemon            │
└──────────────┘                    │  gns3_lab.conf:1-19          │
                                    │                              │
                                    │  ┌────────────────────────┐  │
                                    │  │ s_gns3_network (udp)   │  │
                                    │  │   → d_gns3_nodes       │  │
                                    │  │     (file /var/log/    │  │
                                    │  │      syslog/$HOST/)    │  │
                                    │  │   → d_listener         │  │
                                    │  │     (program pipe to   │  │
                                    │  │     syslog_listener.sh)│  │
                                    │  └───────────┬────────────┘  │
                                    │              │ stdout pipe   │
                                    │              ▼               │
                                    │  ┌──────────────────────┐    │
                                    │  │ syslog_listener.sh   │    │
                                    │  │  :1-60               │    │
                                    │  │  parses Cisco format │    │
                                    │  │  extracts severity,  │    │
                                    │  │  facility, mnemonic  │    │
                                    │  │  POSTs to Watchman   │    │
                                    │  └──────────┬───────────┘    │
                                    └─────────────┼────────────────┘
                                                  │ HTTP POST
                                                  │ /api/syslog/alerts
                                                  │ (host.containers.internal:8000)
                                                  ▼
                                    ┌──────────────────────────────┐
                                    │        watchman container    │
                                    │  syslog_routes.py:63-99      │
                                    │  resolves IP ↔ hostname      │
                                    │  from hosts.ini              │
                                    │  stores in MongoDB           │
                                    └────────────────┬─────────────┘
                                                     │
                                                     ▼
                                    ┌──────────────────────────────┐
                                    │  MongoDB syslog_alerts       │
                                    │  collection                  │
                                    │  (database.py:28)            │
                                    └────────────────┬─────────────┘
                                                     │
                                    ┌────────────────────┼──────────┐
                                    │ Dashboard.jsx:142-154         │
                                    │ polls every 5s via            │
                                    │ GET /api/syslog/alerts        │
                                    │ syslog_routes.py:56-61        │
                                    │ last 50, sorted -timestamp    │
                                    └────────────────┬──────────────┘
                                                 │
                                                 ▼
                                    ┌──────────────────────────────┐
                                    │  Browser renders             │
                                    │  Syslog Intelligence card    │
                                    │  Dashboard.jsx:667-719       │
                                    │  severity-colored badges     │
                                    │  device, mnemonic, message   │
                                    └──────────────────────────────┘
```

## Step-by-step

### 1. Device sends syslog (UDP)

Cisco IOS devices are configured (via playbook or manually) to send syslog to the Sentry-Pod host on UDP port 10514:

```
logging host 10.0.0.5 transport udp port 10514
logging on
logging facility local7
logging trap notifications
```

### 2. syslog-ng receives the message

**File:** `watchman/playbooks/gns3_lab.conf:1-19`

The syslog-ng daemon running inside the `sentry-pod_syslog-ng_1` container listens on UDP 10514:

- `:4` — `source s_gns3_network` binds UDP on `0.0.0.0:10514` with `flags(no-parse)` (raw message, no internal parsing)
- `:8` — `destination d_gns3_nodes` writes the raw message to `/var/log/syslog/$HOST/debug.log` (one file per source host, for archival)
- `:12` — `destination d_listener` pipes **each message as a line** (via `program()` destination) to `/usr/local/bin/syslog_listener.sh` with template `${HOST} ${MESSAGE}\n`
- `:15-19` — The `log` block connects source → both destinations

The syslog-ng container is defined in `podman-compose.yaml:26-37`, built from `Dockerfile.syslog-ng:1-15`.

**Known issue:** `Dockerfile.syslog-ng:1` has a typo (`oooFROM` instead of `FROM`). Docker tolerates it but it should be fixed.

### 3. syslog_listener.sh parses the message

**File:** `watchman/scripts/syslog_listener.sh:1-60`

This script reads syslog lines from stdin (piped by syslog-ng) and:

- `:3` — Target API URL from `$SYSLOG_API_URL` env var, defaulting to `http://host.containers.internal:8000/api/syslog/alerts` (`host.containers.internal` is Podman's magic hostname for the container host)
- `:5` — Array of severity names: Emergency(0) through Debug(7)
- `:7-9` — Reads stdin line by line, skips empty
- `:10-11` — Extracts `source_ip` (first word) and `rest` (everything after)
- `:15-21` — Regex to extract `msg_hostname` from the syslog header (if present). Handles various syslog formats
- `:23-29` — If no hostname found, tries to extract an IP from the raw message as fallback
- `:31-35` — **Core parse**: regex `%([A-Za-z0-9_/-]+)-([0-7])-([A-Za-z0-9_/-]+): (.*)` extracts:
  - Group 1 → `facility` (e.g. `LINEPROTO`, `SYS`, `LINK`)
  - Group 2 → `severity` (0-7 numeric)
  - Group 3 → `mnemonic` (e.g. `UPDOWN`, `CHANGED`, `AUTH_FAIL`)
  - Group 4 → `msg_text` (the human-readable message)
- `:37` — Filters: only forwards messages with severity ≤ 5 (i.e., Emergency through Notification; Debug is skipped)
- `:38-53` — Builds a JSON payload with `source_ip`, `facility`, `severity`, `severity_name`, `mnemonic`, `message`, `timestamp`, and optional `msg_hostname`
- `:55-57` — POSTs the JSON to Watchman API via `curl -s -X POST`

### 4. Watchman API stores the alert

**File:** `watchman/app/routes/syslog_routes.py:63-99`

- `:64` — `async def create_alert(alert: SyslogAlertCreate)` — receives the parsed syslog payload
- `:66-67` — Loads IP-to-hostname and hostname-to-IP mappings from `watchman/playbooks/hosts.ini` (`:10`, `:12-54`)
- `:68-70` — Normalizes the timestamp (uses current UTC if none provided, ensures timezone-aware)
- `:72-86` — **Two-tier IP resolution**:
  - Tier 1: If `alert.msg_hostname` is present, looks up `host_to_ip` map (`:76-78`)
  - Tier 2: If no hostname match, resolves `source_ip` back to hostname via `ip_to_host` map (`:83-84`)
  - Result: `device` string like `"Router1 (10.0.0.1)"` or just `"10.0.0.1"` if unresolved
- `:88-97` — Constructs a `SyslogAlert` document (`models/syslog.py:5-13`) and inserts into MongoDB `syslog_alerts` collection
- `:98` — Returns `{"status": "ok"}`

### 5. Data stored in MongoDB

**File:** `watchman/app/database.py:28`

Collection: `syslog_alerts` — defined on `database.py:28`

Each document has the schema from `SyslogAlert` (`models/syslog.py:5-13`):
- `device` — string like `"Hostname (IP)"` or bare IP
- `severity` — int 0-7
- `severity_name` — string (`"Critical"`, `"Warning"`, etc.)
- `facility` — string (`"LINEPROTO"`, etc.)
- `mnemonic` — string (`"UPDOWN"`, etc.)
- `message` — string (human-readable)
- `timestamp` — datetime (UTC, timezone-aware)
- `source_ip` — string

Index: `database.py:44` — descending index on `timestamp` for efficient latest-first queries.

### 6. Frontend polls for alerts

**File:** `frontend/src/pages/Dashboard.jsx:142-154`

- `:143-150` — `fetchSyslogAlerts()` calls `GET ${API_BASE}/api/syslog/alerts` (defaults to `http://127.0.0.1:8000/api/syslog/alerts`)
- `:152` — Polling interval: **every 5 seconds** via `setInterval(fetchSyslogAlerts, 5000)`
- `:153` — Cleanup on unmount: `clearInterval(interval)` to prevent memory leaks

**File:** `watchman/app/routes/syslog_routes.py:56-61`

- `:57` — `async def get_alerts(limit: int = 50)` — returns up to 50 alerts
- `:59` — Query: `.find().sort("timestamp", -1).limit(limit)` — newest first

### 7. Dashboard renders the alerts

**File:** `frontend/src/pages/Dashboard.jsx:667-719`

- `:672-681` — Card header with "Syslog Intelligence" title and alert count badge
- `:684-718` — Alert list with per-alert rendering:
  - `:692` — Severity-based coloring: severity ≤ 1 → critical (rose), ≤ 3 → warning (orange), else → info (amber)
  - `:693` — "Time ago" calculation: `Math.floor((Date.now() - alert.timestamp) / 60000)` (minutes)
  - `:701-703` — Severity badge (e.g. `CRITICAL`, `WARNING`)
  - `:704` — Device name (e.g. `Router1 (10.0.0.1)`)
  - `:708` — Mnemonic (e.g. `UPDOWN`)
  - `:710-711` — Full message text (clamped to 2 lines via CSS)

## Failure modes

| What breaks | Symptom | Root cause |
|---|---|---|
| No alerts appear | "No critical syslog messages" | syslog_listener.sh not running (not auto-launched by CMD in Dockerfile.syslog-ng) |
| Alerts show bare IPs | No hostname resolution | `hosts.ini` missing or misconfigured for the device's IP |
| Alerts stop appearing | Stale data | Dashboard `setInterval` cleared on unmount; re-navigate to Dashboard |
| All severity levels missing | Only ≤ 5 shown | `syslog_listener.sh:37` filters out Debug(6) and (7) |
| `curl` POST fails | No alerts at all | Watchman API not reachable on `host.containers.internal:8000` — check container networking |
| syslog-ng fails to start | Container exits | Typo `oooFROM` in `Dockerfile.syslog-ng:1` — Docker may reject the Dockerfile |
| High volume of alerts | Dashboard performance | No pagination on GET (always returns last 50) |

## Key files

| File | Lines | Role |
|---|---|---|
| `podman-compose.yaml` | 26-37 | Syslog-ng container definition |
| `watchman/Dockerfile.syslog-ng` | 1-15 | Container build (note typo on line 1) |
| `watchman/playbooks/gns3_lab.conf` | 1-19 | syslog-ng config: UDP source, file + script destinations |
| `watchman/scripts/syslog_listener.sh` | 1-60 | Cisco syslog parser and HTTP forwarder |
| `watchman/app/routes/syslog_routes.py` | 56-105 | GET/POST/DELETE endpoints for alerts |
| `watchman/app/models/syslog.py` | 1-23 | SyslogAlert and SyslogAlertCreate schemas |
| `watchman/app/database.py` | 28, 44 | Collection name and index |
| `frontend/src/pages/Dashboard.jsx` | 142-154, 667-719 | Polling interval and alert rendering |
| `watchman/playbooks/hosts.ini` | — | IP ↔ hostname mapping (used by syslog_routes.py:10, 12-54) |

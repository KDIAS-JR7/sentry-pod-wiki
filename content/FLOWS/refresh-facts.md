# Refresh Facts Flow

## Diagram

```
User clicks "Refresh Facts" (e.g., on NetworkDevices page)
    │
    ▼
RefreshFactsModal.jsx ──EventSource──▶ GET /api/network/refresh-facts (SSE)
  :14                                     │
                                          ├── podman exec sentry-ansible
                                          │   ansible-playbook get_facts.yml
                                          │     │
                                          │   ├── Collects IOS version, serial,
                                          │   │   interfaces, uptime from each device
                                          │   │
                                          │   └── Saves to playbooks/facts/<device>.json
                                          │
                                          ├── Parse fact files
                                          │   Extract hostname, model, version, interfaces
                                          │
                                          ├── Merge into MongoDB devices collection
                                          │   Upsert by device name, preserve fields
                                          │   not set by facts (e.g., custom tags)
                                          │
                                          └── SSE events streamed:
                                              data: {"type": "output", "line": "..."}
                                              data: {"type": "counts", "total": N, "updated": N, "failed": N}
                                              data: {"type": "complete", "message": "..."}
```

> **Note:** The `getRefreshFactsUrl()` function was referenced in `RefreshFactsModal.jsx:3` but the endpoint `GET /api/network/refresh-facts` was removed during the Phase 2 refactor when `network_routes.py` was split. The frontend component still exists but the backend route needs to be re-implemented for this feature to work. As a workaround, use the playbook streaming endpoint directly.

## Step-by-step

### 1. User triggers refresh

**File:** `frontend/src/components/RefreshFactsModal.jsx:1-168`

- `:14` — Connects to SSE endpoint via `EventSource(url)` where `url = getRefreshFactsUrl()`
- `:15-61` — Listens for SSE events:
  - `output`: appends line to log (`:26`)
  - `status`: appends status message (`:29`)
  - `counts`: sets `{total, updated, failed}` (`:32`)
  - `complete`: marks as done (`:35`)
  - `error`: marks as error (`:40`)
- Auto-scrolls log to bottom (`:64-67`)
- Shows spinner while running, checkmark on complete (`:102-108`)
- Footer shows counts bar with total/updated/failed (`:138-144`)

### 2. Backend SSE generator (original — needs re-implementation)

The original endpoint in `network_routes.py` (before Phase 2 split) did:

1. Run `podman exec sentry-ansible ansible-playbook get_facts.yml`
2. Stream playbook output line-by-line as SSE `output` events
3. Parse the output for fact counts
4. Return `counts` and `complete` events

### 3. Data flow

**Playbook:** `get_facts.yml` connects to each device and collects:
- `ios_version` — IOS/IOS-XE version string
- `serial_number` — device serial
- `model` — hardware model
- `interfaces` — list of interface names + statuses
- `uptime` — system uptime

**Output files:** Saved to `watchman/playbooks/facts/<hostname>.json`

**MongoDB merge:** For each device, upserts into `devices` collection, merging:
- Updates fields: `model`, `version`, `uptime`
- Preserves fields: `id`, `name`, `ip`, `type`, custom tags
- Adds/removes interfaces

### 4. Current workaround

Since the SSE endpoint was removed during refactoring, use the playbook execution flow instead:

```
Frontend: POST /playbooks/execute {playbook_name: "get_facts.yml"}
    → Blocking execution, returns full output
```

Or use the SSE streaming variant for real-time progress:

```
Frontend: GET /playbooks/execute-stream/get_facts.yml
    → SSE stream of playbook output
```

## Key files

| File | Lines | Role |
|---|---|---|
| `frontend/src/components/RefreshFactsModal.jsx` | 1-168 | SSE modal UI (needs backend endpoint) |
| `watchman/playbooks/get_facts.yml` | — | Ansible fact collection playbook |
| `watchman/playbooks/facts/` | — | Fact output file directory |
| `docs/REFRESH_FACTS.md` | — | Original design doc |

## Known issue

The `getRefreshFactsUrl()` function is imported in `RefreshFactsModal.jsx:3` from `services/networkService.js` but was removed during the Phase 2 service split. The `RefreshFactsModal` component is non-functional until the endpoint is re-implemented or the import is redirected to the playbook SSE endpoint.

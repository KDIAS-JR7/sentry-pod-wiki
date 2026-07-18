# Configuration Drift Flow

## Diagram

```
Trigger ──POST /playbooks/drift/refresh──▶ watchman
  (Dashboard "Refresh" button)             playbook_routes.py:142-183
                                           execution_service.run_drift_analysis():99-102
                                               │
                                               ▼
                                    sentry-ansible container
                                      run_action.sh drift
                                      goldenState.yml (baseline)
                                      configDrift.yml (diff)
                                               │
                                               ▼
                                    Drift files written to
                                    watchman/playbooks/configDrift/
                                    DRIFT_<hostname>.diff
                                               │
                                               ▼
                                    Drift parsed by
                                    drift_service.py:17-51
                                    → returns reports list
                                               │
                                               ▼
                                    Response: {drift_count, reports[]}
                                    Frontend updates stat card
                                    + renders DiffViewer
```

## Step-by-step

### 1. Baseline collection (prerequisite)

Before drift can be detected, a **golden state baseline** must exist for each device.

**Trigger:** `POST /playbooks/baseline/refresh` — `playbook_routes.py:197-238`
- Calls `execution_service.run_baseline_collection()` (`:202`)
- Inside the sentry-ansible container, runs `run_action.sh collect`
- Runs `goldenState.yml` playbook which connects to each device and captures running config
- Saves to `watchman/playbooks/goldenState/GS_<hostname>.txt`
- Parses baseline count from output via regex `"Total Devices Baselined: (\d+)"` (`:205`)
- Returns `baseline_count` and list of device names

### 2. Drift analysis trigger

**Two trigger points:**

**A. Dashboard "Refresh" button** — `frontend/src/pages/Dashboard.jsx:187-207`
- `handleRefreshDrift()` calls `POST ${API_BASE}/playbooks/drift/refresh` (`:191`)

**B. DriftReports page** — `frontend/src/pages/DriftReports.jsx` (mounts)
- Fetches `GET /playbooks/drift` on page load to display current reports

### 3. Backend drift refresh

**File:** `watchman/app/routes/playbook_routes.py:142-183`

- `:147` — Calls `execution_service.run_drift_analysis()`
- `:150` — Parses output for `"Total Devices with Drift: (\d+)"` regex
- `:154` — Calls `drift_service.parse_config_drift_reports()` to get latest parsed reports
- `:157-169` — Records audit log entry to `audit_logs` collection
- `:171-176` — Returns `{drift_count, output, reports[]}`

### 4. sentry-ansible runs drift analysis

**File:** `watchman/app/services/execution_service.py:99-102`

```python
def run_drift_analysis() -> Tuple[int, str]:
    cmd = _build_podman_command(
        ["/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "drift"],
        scripts_mount=True
    )
    return _run_podman(cmd)
```

The `run_action.sh drift` script inside the container:
1. Runs `configDrift.yml` playbook, which for each device:
   - Fetches current running config
   - Diffs it against golden state baseline (`GS_<hostname>.txt`)
   - Generates unified diff output
2. Writes diff files to `watchman/playbooks/configDrift/DRIFT_<hostname>.diff`

### 5. Drift reports parsed

**File:** `watchman/app/services/drift_service.py:17-51`

```python
def parse_config_drift_reports() -> List[dict]:
    drift_dir = PLAYBOOKS_DIR / "configDrift"  # :18
    # ...iterates DRIFT_*.diff files...
    for path in sorted(drift_dir.glob('DRIFT_*.diff')):  # :22
        hostname = path.name.replace('DRIFT_', '').replace('.diff', '')  # :24
        text = path.read_text()  # :25
        text = _strip_ansi(text)  # :26 — removes ANSI escape codes
        # Parses +/- lines for added/removed config lines  # :28-39
        results.append({...})  # :40-48
```

Each report includes:
- `hostname` — extracted from filename
- `path` — relative path to diff file
- `mtime` — modification timestamp
- `diff_content` — full ANSI-stripped diff text
- `additions` — list of `+` lines (config added)
- `removals` — list of `-` lines (config removed)
- `summary` — `{added: N, removed: M}` or null if no drift

### 6. Frontend renders drift

**A. Dashboard** — `frontend/src/pages/Dashboard.jsx:86-98`

On mount:
```javascript
const res = await fetch(`${API_BASE}/playbooks/drift`);
const data = await res.json();
if (data && data.reports) setDriftReports(data.reports);
```

Renders in two places:
- **Stat card** (`:326-352`): Shows drift alert count, clickable to navigate to `/drift-reports`
- **Drift card** (`:626-665`): Shows latest diff via `<DiffViewer>` component

**B. DriftReports page** — `frontend/src/pages/DriftReports.jsx`

Lists all drift reports with hostname, timestamp, and summary.

**C. DriftReportDetail page** — `frontend/src/pages/DriftReportDetail.jsx`

Full-page view at `/drift-reports/:hostname`:
- Calls `GET /playbooks/drift/{hostname}` (`playbook_routes.py:128-140`)
- `drift_service.read_config_drift_file(hostname):54-65` reads the `.diff` file
- Renders full diff with syntax coloring via `DiffViewer.jsx`

### 7. DiffViewer component

**File:** `frontend/src/components/DiffViewer.jsx`

Parses unified diff format and renders with:
- Red background for removed lines (`-`)
- Green background for added lines (`+`)
- Grey for context lines (starting with space)
- Hunk headers shown as separators

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/playbook_routes.py` | 115-126 | `GET /playbooks/drift` — list reports |
| `watchman/app/routes/playbook_routes.py` | 128-140 | `GET /playbooks/drift/{hostname}` — single report |
| `watchman/app/routes/playbook_routes.py` | 142-183 | `POST /playbooks/drift/refresh` — run analysis |
| `watchman/app/routes/playbook_routes.py` | 197-238 | `POST /playbooks/baseline/refresh` — collect baselines |
| `watchman/app/services/drift_service.py` | 1-75 | Parse drift files, read single file, list baselines |
| `watchman/app/services/execution_service.py` | 99-102 | `run_drift_analysis()` — podman command |
| `watchman/app/services/execution_service.py` | 105-108 | `run_baseline_collection()` — podman command |
| `watchman/playbooks/goldenState/` | — | Baseline config files (GS_*.txt) |
| `watchman/playbooks/configDrift/` | — | Drift diff files (DRIFT_*.diff) |
| `frontend/src/pages/Dashboard.jsx` | 86-98, 187-207, 326-352, 626-665 | Drift fetch, refresh, display |
| `frontend/src/pages/DriftReports.jsx` | — | Report listing |
| `frontend/src/pages/DriftReportDetail.jsx` | — | Full diff page |
| `frontend/src/components/DiffViewer.jsx` | — | Diff renderer component |
| `frontend/src/utils/diffParser.js` | — | Unified diff parser utility |

## Failure modes

| What breaks | Symptom | Root cause |
|---|---|---|
| No golden state baseline | "No devices baselined" | Run `POST /playbooks/baseline/refresh` first |
| DRIFT_*.diff files missing | Drift count = 0 | `configDrift.yml` playbook failed or no drift detected |
| ANSI codes in diff text | Weird `[32m` characters in UI | `_strip_ansi()` in `drift_service.py:13-14` should strip them; check regex |
| Baseline overwritten without confirmation | Users surprised | `handleRefreshBaseline()` in Dashboard requires checkbox confirmation (`:754-765`) |

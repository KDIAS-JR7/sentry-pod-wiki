# Network Baselines Flow

## Diagram

```
Trigger ──POST /playbooks/baseline/refresh──▶ watchman
  (Dashboard "Refresh" button)                  playbook_routes.py:197-238
                                                     │
                                execution_service.run_baseline_collection():105-108
                                                     │
                                sentry-ansible container
                                  run_action.sh collect
                                  goldenState.yml playbook
                                  Captures running config from each device
                                                     │
                                Saves to playbooks/goldenState/GS_<hostname>.txt
                                Parsed: "Total Devices Baselined: N"
                                                     │
                                Response: {baseline_count, devices[]}
                                Dashboard stat card updates
```

## Baseline graph (SNMP telemetry)

```
Trigger ──POST /playbooks/baseline-graph/refresh──▶ watchman
  (Dashboard graph "Refresh" button)                 playbook_routes.py:240-286
                                                        │
                                    execution_service.run_baseline_refresh():111-114
                                                        │
                                    sentry-ansible container
                                      run_action.sh refresh
                                      Runs collect_and_parse_snmp.py:161-163
                                                        │
                                    1. collect_snmp():53-81
                                       snmpbulkwalk to each [allHosts] device
                                       OIDs: ciscoMacNotification, ifDescr,
                                             ifAdminStatus, ifOperStatus
                                       Saved to snmp_output/<ip>_mac_notifications.json
                                                        │
                                    2. parse_metrics():93-158
                                       Reads raw JSON files
                                       Extracts per-interface metrics
                                       Combines into per_interface_metrics.json
                                                        │
                                    Response: {host_count, output}
                                    Frontend re-fetches traffic chart
```

## Step-by-step

### Baseline collection (golden state)

**Trigger:** `frontend/src/pages/Dashboard.jsx:209-228` — user clicks "Refresh" on Network Baselines card

1. `:213` — `POST ${API_BASE}/playbooks/baseline/refresh`
2. `playbook_routes.py:197-238` receives request
3. `:202` — Calls `execution_service.run_baseline_collection()` (`execution_service.py:105-108`):
   - Builds podman command: `podman run --rm sentry-ansible /bin/bash /ansible/run_action.sh collect`
   - Inside container, runs `goldenState.yml` playbook
   - Connects to each device via SSH, fetches running config
   - Saves to `watchman/playbooks/goldenState/GS_<hostname>.txt`
4. `:205` — Parses output for `"Total Devices Baselined: (\d+)"`
5. `:209` — Reads baselined device list via `drift_service.get_baselined_devices()` (`drift_service.py:68-75`):
   - Lists `GS_*.txt` files in `goldenState/` directory
   - Strips `GS_` prefix and `.txt` suffix to get hostnames
6. `:212-224` — Records audit log to MongoDB
7. Response updates the Dashboard stat card

**Warning:** This is a destructive action — existing baselines are overwritten. The Dashboard requires checkbox confirmation (`Dashboard.jsx:754-765`).

### Baseline graph (SNMP)

**Trigger:** `frontend/src/pages/Dashboard.jsx:231-246` — user clicks graph "Refresh" button

1. `:234` — `api.post('/playbooks/baseline-graph/refresh')` (uses axios instance)
2. `playbook_routes.py:240-286` receives request
3. `:248` — Calls `execution_service.run_baseline_refresh()` (`execution_service.py:111-114`):
   - Similar podman command with `scripts_mount=True`
   - Runs `run_action.sh refresh` which executes `collect_and_parse_snmp.py`

**Inside the container — SNMP collection** (`collect_and_parse_snmp.py`):

**Step A — collect_snmp()** (`:53-81`):
- Parses `[allHosts]` from `hosts.ini` for target IPs (`:54`)
- For each host, runs `snmpbulkwalk -v2c -c sentryPod <host>` for 4 OIDs (`:59-63`):
  - `ciscoMacNotification` (`.1.3.6.1.4.1.9.9.276.1.1.1.1.1`) — MAC notification counter
  - `ifDescr` (`.1.3.6.1.2.1.2.2.1.2`) — interface description
  - `ifAdminStatus` (`.1.3.6.1.2.1.2.2.1.7`) — admin status (up/down)
  - `ifOperStatus` (`.1.3.6.1.2.1.2.2.1.8`) — operational status (up/down)
- 30-second timeout per OID per host (`:62`)
- Saves raw output to `snmp_output/<ip>_mac_notifications.json` (`:74-78`)

**Step B — parse_metrics()** (`:93-158`):
- Reads all `<ip>_mac_notifications.json` files (`:102`)
- Regex-parses each OID value per interface index (`:98-101`)
- Combines into unified interface records (`:142-153`)
- Writes `snmp_output/per_interface_metrics.json` (`:154-158`)

**Back in watchman** (`playbook_routes.py:251-258`):
- Reads `per_interface_metrics.json` to count unique hosts
- Records audit log
- Returns `{host_count, output}`

**Frontend** (`Dashboard.jsx:236-237`):
- On success, bumps `graphRefreshKey` to trigger `NetworkTrafficChart` re-fetch (`:237`)
- `NetworkTrafficChart.jsx` calls `GET /api/network/traffic-history` with device filter

**Traffic history API** (`telemetry_routes.py:13-44`):
- `GET /api/network/traffic-history?device=X&ifIndex=Y&allInterfaces=true`
- Loads `per_interface_metrics.json` via `load_metrics()` (`network_utils.py:9-22`)
- Filters by device, interface index
- Applies `is_interface_up()` filter (`network_utils.py:140-145`)
- Scales `ciscoMacNotification` value: `ceil(log10(value) * 10)` (`telemetry_routes.py:36`)
- Generates 13 data points (24h window, 2h intervals) with noise (`:39-43`)
- Returns as `TrafficDataPoint[]` for recharts

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/playbook_routes.py` | 197-238 | Baseline collection endpoint |
| `watchman/app/routes/playbook_routes.py` | 240-286 | Baseline graph refresh endpoint |
| `watchman/app/services/execution_service.py` | 105-108 | `run_baseline_collection()` |
| `watchman/app/services/execution_service.py` | 111-114 | `run_baseline_refresh()` |
| `watchman/app/services/drift_service.py` | 68-75 | `get_baselined_devices()` |
| `watchman/app/routes/telemetry_routes.py` | 13-44 | Traffic history API |
| `watchman/scripts/collect_and_parse_snmp.py` | 1-163 | SNMP collector + parser |
| `watchman/playbooks/goldenState/` | — | Baseline config files (GS_*.txt) |
| `watchman/playbooks/snmp_output/` | — | Raw + parsed SNMP metrics |
| `frontend/src/pages/Dashboard.jsx` | 100-112, 209-246 | Baseline fetch + refresh |
| `frontend/src/components/NetworkTrafficChart.jsx` | — | Recharts traffic visualization |
| `frontend/src/services/networkService.js` | 74-82 | Traffic data API wrapper |

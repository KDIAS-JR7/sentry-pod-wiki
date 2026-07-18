# Scripts Reference

All scripts in `watchman/scripts/`.

| Script | Lines | Language | Purpose |
|---|---|---|---|
| `container_manager.py` | — | Python | Unified CLI: build, up, down, status, run, shell, check for sentry-ansible |
| `smoke_test.py` | — | Python | Full stack health check (backend API, containers, nmap, frontend) |
| `create_admin.py` | — | Python | Create initial admin user in MongoDB |
| `sync_users.py` | — | Python | Sync users from Atlas → local vault |
| `entrypoint.sh` | 26 | Bash | Container startup: clean Podman storage, load sentry-ansible image, start uvicorn |
| `syslog_listener.sh` | 60 | Bash | Cisco syslog parser: reads from stdin, POSTs to Watchman API |
| `nmap_scan.py` | — | Python | Ping scan network → `active_devices.json` |
| `collect_and_parse_snmp.py` | 163 | Python | SNMP bulkwalk + metric parser → `per_interface_metrics.json` |
| `parse_drift.py` | — | Python | CLI drift summary printer (host-side) |
| `cleanup_data.py` | — | Python | Clean old playbook output data |
| `run_playbook.sh` | — | Bash | Linux/macOS shell wrapper for podman playbook execution |
| `run_playbook.bat` | — | Batch | Windows batch wrapper for podman playbook execution |
| `run_collect_for_duration.sh` | — | Bash | SNMP collection over a time window |
| `syslog_listener.sh` | — | Bash | Bash syslog listener |
| `test_playbook_management.py` | — | Python | Test script for playbook management |

## Key script details

### `entrypoint.sh` (26 lines)
- `:5-8` — Detects stale Podman storage (boot ID differs), cleans if needed
- `:10-24` — Loads `sentry-ansible.tar` into Podman if image not present
- `:26` — Starts uvicorn with `--limit-concurrency 100`

### `nmap_scan.py`
- Called by `POST /api/network/active-devices/scan` (`device_routes.py:46-66`)
- Runs `nmap -sn` ping scan
- Output: `nmap_output/active_devices.json` with `{ip, model, version, uptime}` per device
- 180-second timeout

### `collect_and_parse_snmp.py`
- Called by `POST /playbooks/baseline-graph/refresh` via `run_action.sh refresh`
- Two-phase: `collect_snmp()` → `parse_metrics()`
- Uses `snmpbulkwalk` with 4 OIDs (ciscoMacNotification, ifDescr, ifAdminStatus, ifOperStatus)
- Output: `playbooks/snmp_output/per_interface_metrics.json`

### `sync_users.py`
- One-way sync from Atlas → local vault
- Useful when switching from Atlas to offline development

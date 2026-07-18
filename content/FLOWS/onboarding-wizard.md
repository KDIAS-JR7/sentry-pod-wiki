# Onboarding Wizard Flow

## Overview

The 5-step Setup Wizard guides the user through initial network configuration. It replaces demo inventory data with the user's actual devices.

## Steps

| Step | UI Component | What user does |
|---|---|---|
| 1 | `SetupWizard.jsx` | Welcome + global credentials (SSH user/pass, SNMP community) |
| 2 | `SetupWizard.jsx` | Add Edge Routers (hostname + IP) |
| 3 | `SetupWizard.jsx` | Add Core + Distribution Switches + HSRP pairs |
| 4 | `SetupWizard.jsx` | Add Access Switches (hostname, IP, VLAN, gateway) |
| 5 | `SetupWizard.jsx` | Preview diff + confirm + apply |

## Data flow

```
Step 1-4: User fills forms
    │
    ▼
POST /setup/preview ──▶ setup_routes.py:60-83
  {global_creds,        │
   edge_routers[],      ├── 1. Read current hosts.ini
   core_switches[],     │   setup_service.read_current_ini():252-256
   ...}                 │
                        ├── 2. Render new hosts.ini
                        │   setup_service.render_ini():16-102
                        │
                        ├── 3. Compute diff vs current
                        │   setup_service.compute_diff():133-152
                        │
                        ├── 4. Check warnings
                        │   setup_service._check_warnings():155-167
                        │
                        ├── 5. Generate flush plan
                        │   setup_service.get_flush_plan():303-318
                        │
                        ├── 6. Generate markdown report
                        │   setup_service.generate_report_markdown():170-240
                        │
                        └── 7. Return preview
                            {generated_ini, diff, warnings, flush_plan, report}
                                │
                                ▼
                    Step 5: User reviews diff in UI
                                │
                                ▼
POST /setup/apply ──▶ setup_routes.py:86-128
  same payload +       │
  flush_mongo,         ├── 1. Re-run pipeline (same as preview)
  flush_disk           │
                        ├── 2. Write hosts.ini to disk
                        │   setup_service.write_ini():259-261
                        │
                        ├── 3. Flush MongoDB collections (devices,
                        │   device_configurations, cdp_neighbors,
                        │   topology_cache)
                        │   setup_service.flush_mongo_collections():264-274
                        │
                        └── 4. Flush disk artifacts (goldenState/
                            configDrift/ cdp_output/ facts/ runningConfigs/)
                            setup_service.flush_disk_artifacts():277-300
```

## Step-by-step

### 1-4. User fills device data

**File:** `frontend/src/pages/SetupWizard.jsx`

- 5-step form collecting:
  - Global credentials (ansible_user, ansible_password, become_password, snmp_community)
  - Edge Routers: list of `{hostname, ip}`
  - Core Switches: list of `{hostname, ip}`
  - Distribution Switches: list of `{hostname, ip}`
  - HSRP pairs: list of hostnames from distribution switches
  - Access Switches: list of `{hostname, ip, vlan_id, vlan_name, default_gateway}`

### 5. Preview

**File:** `setup_routes.py:60-83`

Calls `_run_setup_pipeline()` (`:49-57`) which:

**Read current hosts.ini** (`setup_service.py:252-256`):
- Reads existing file or returns empty string if none exists

**Render new hosts.ini** (`:16-102`):
- Generates INI format with sections: `[allHosts]`, `[Edge_routers]`, `[Core_Switches]`, `[Distribution_Switches]`, `[HSRP_Routers]`, `[Access_Switches]`, `[allHosts:vars]`
- Each device line: `hostname ansible_host=ip` with optional extra vars for access switches (vlan_id, vlan_name, defaultGateway)
- Vars section includes: `ansible_network_os=cisco.ios.ios`, `ansible_connection=network_cli`, credentials

**Compute diff** (`:133-152`):
- Compares device entries between current and new INI
- Returns `{added: [], removed: [], changed: [], unchanged: N}`

**Check warnings** (`:155-167`):
- Access switch with no `default_gateway` → `defaultGateway.yml` will fail
- Access switch with no `vlan_id` → VLAN playbooks may fail
- Fewer than 2 HSRP devices → HSRP won't work
- No SNMP community → telemetry will fail

**Generate report** (`:170-240`):
- Creates a markdown report with summary table, generated INI, diff, warnings, and flush plan
- Saved to `watchman/docs/onboarding_report_<date>.md`

### 6. Apply

**File:** `setup_routes.py:86-128`

- `:96` — Re-runs the same pipeline
- `:102` — Writes `hosts.ini` to disk (only if not dry_run)
- `:103-104` — Flushes MongoDB collections: `devices`, `device_configurations`, `cdp_neighbors`, `topology_cache` (`setup_service.py:264-274`)
- `:105-106` — Flushes disk artifacts: golden state baselines, drift reports, CDP output, facts, running configs (`setup_service.py:277-300`)
- Supports `?dry_run=true` to validate without writing

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/setup_routes.py` | 1-179 | Preview/apply/init endpoints |
| `watchman/app/services/setup_service.py` | 16-102 | INI rendering |
| `watchman/app/services/setup_service.py` | 133-152 | Diff computation |
| `watchman/app/services/setup_service.py` | 155-167 | Warning checks |
| `watchman/app/services/setup_service.py` | 170-240 | Markdown report generation |
| `watchman/app/services/setup_service.py` | 264-274 | MongoDB flush |
| `watchman/app/services/setup_service.py` | 277-300 | Disk artifact flush |
| `watchman/app/services/setup_service.py` | 321-352 | Detection (is demo?) |
| `watchman/app/services/setup_service.py` | 355-385 | Initial Super Admin creation |
| `watchman/app/services/setup_service.py` | 388-427 | Collection/index initialization |
| `watchman/app/models/setup.py` | 1-64 | Request/response schemas |
| `frontend/src/pages/SetupWizard.jsx` | — | 5-step UI |
| `frontend/src/services/setupService.js` | — | API call wrappers |

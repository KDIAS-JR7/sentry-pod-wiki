# Device Status Algorithm

The device status system uses a **4-tier cascading algorithm** to determine network health. If a higher tier (e.g., Edge) is fully down, all lower tiers (Core, Distribution, Access) are automatically marked as "degraded" — there's no point reporting individual devices as healthy when their upstream connectivity is broken.

## Tier hierarchy

```
Tier 0: Edge/WAN        (routers)     ← if all down → everything degrades
Tier 1: Core            (switches)    ← if all down → distribution + access degrade
Tier 2: Distribution    (switches)    ← if all down → access degrades
Tier 3: Access          (switches)    ← leaf tier, no downstream
```

## Data flow

```
1. hosts.ini parsed into device list
   network_utils.py:57-95 (load_devices_from_inventory)

2. Nmap ping scan writes active_devices.json
   nmap_scan.py → nmap_output/active_devices.json

3. API call: GET /api/network/device-status
   network_utils.py:179-247 (_build_device_status)
       │
       ├── Load devices from inventory
       ├── Load active IPs from nmap_output
       ├── Assign tier per device (DEVICE_TIER map)
       ├── Cascading algorithm:
       │     for each tier in [edge, core, distribution, access]:
       │         if cascade_down:
       │             mark all devices as degraded + reason
       │         elif all devices in tier offline:
       │             set cascade_down = true
       │         else:
       │             normal online/offline per device
       └── Return {devices[], online/degraded/offline counts, tier_summary}

4. Dashboard.jsx:131-140 fetches on mount
   Dashboard.jsx:175-185 can trigger nmap rescan
```

## Algorithm details

**File:** `watchman/app/routes/network_utils.py:179-247`

### Input sources

**Device inventory** (`:181`):
- Parsed from `hosts.ini` via `load_devices_from_inventory()` (`:57-95`)
- Groups: `edge_routers` → `router`, `core_switches`/`distribution_switches`/`access_switches` → `switch`

**Active IPs** (`:183-195`):
- Read from `nmap_output/active_devices.json` produced by `nmap_scan.py`
- Sets `active_ips` set for O(1) lookups

**Tier assignment** (`:200`):
- Uses `DEVICE_TIER` hardcoded map (`:159-166`) — same values as topology_service
- Default: `access` for unknown devices

### Cascading logic (`:209-229`)

```python
cascade_down = False
cascade_reason = None
for tier in TIER_ORDER:  # edge → core → distribution → access
    tier_devices = [d for d in all_devices if d.get("tier") == tier]
    tier_online_count = sum(1 for d in tier_devices if d.get("online"))

    if cascade_down:
        # All downstream tiers are degraded
        for d in tier_devices:
            d["effective_status"] = "degraded"
            d["status_reason"] = cascade_reason
    elif tier_online_count == 0:
        # This entire tier is offline — cascade starts
        for d in tier_devices:
            d["effective_status"] = "offline"
            d["status_reason"] = None
        cascade_down = True
        cascade_reason = f"{tier}_layer_down"
    else:
        # Normal: each device gets its own status
        for d in tier_devices:
            d["effective_status"] = "online" if d.get("online") else "offline"
            d["status_reason"] = None
```

### Response structure (`:242-247`)

```json
{
  "devices": [{"name", "ip", "tier", "online", "effective_status", "status_reason", ...}],
  "online_count": 12,
  "offline_count": 2,
  "degraded_count": 4,
  "total_count": 18,
  "scan_timestamp": "2026-07-18T10:30:00Z",
  "tier_summary": {
    "edge": {"total": 2, "online": 2, "healthy": true, "label": "Edge/WAN"},
    "core": {"total": 2, "online": 2, "healthy": true, "label": "Core"},
    "distribution": {"total": 4, "online": 3, "healthy": true, "label": "Distribution"},
    "access": {"total": 10, "online": 5, "healthy": true, "label": "Access"}
  }
}
```

## Frontend rendering

**File:** `frontend/src/pages/Dashboard.jsx:496-621`

- Network Status table shows each device with:
  - Tier badge (colored: purple=edge, blue=core, cyan=distribution, slate=access)
  - Status indicator (green UP / red DOWN / amber DEG)
  - Status reason text (e.g., "Edge/WAN layer is fully down")
  - Model, IP, last check time

**File:** `frontend/src/pages/Dashboard.jsx:505-527`

- Mini tier summary bar:
  - Shows `online_count / total_count online`
  - Shows `N degraded` if any
  - Shows `N tier(s) down` if any tier fully offline

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/network_utils.py` | 57-95 | `load_devices_from_inventory()` — host.ini parser |
| `watchman/app/routes/network_utils.py` | 159-166 | `DEVICE_TIER` map |
| `watchman/app/routes/network_utils.py` | 179-247 | `_build_device_status()` — cascading algorithm |
| `watchman/app/routes/device_routes.py` | 69-93 | `GET /api/network/device-status` + scan |
| `watchman/scripts/nmap_scan.py` | — | Ping scan → `active_devices.json` |
| `frontend/src/pages/Dashboard.jsx` | 131-140, 175-185, 496-621 | Fetch, refresh, render |

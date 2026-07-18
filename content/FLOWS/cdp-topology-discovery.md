# CDP Topology Discovery Flow

## Diagram

```
Trigger ──POST /api/topology/refresh──▶ watchman
  (button in UI)                         topology_routes.py:33-44
                                                  │
                             topology_service.refresh_topology():307-342
                                                  │
                             1. podman exec getCDPNeighbors.yml
                                Ansible playbook runs "show cdp neighbors detail"
                                on each device
                                  │
                             2. Output files written to:
                                watchman/playbooks/cdp_output/<device>.txt
                                  │
                             3. parse_all_cdp_files():139-152
                                Iterates all *.txt files
                                Parses CDP detail or brief format
                                  │
                             4. build_graph(neighbors):234-276
                                discover_tiers():169-229 (BFS)
                                Builds nodes + edges
                                  │
                             5. store_neighbors():281-288
                                store_graph():291-294
                                → MongoDB cdp_neighbors + topology_cache
                                  │
                             6. Response: {nodes, edges, neighbors}
```

## Step-by-step

### 1. Trigger refresh

**Options:**
- `POST /api/topology/refresh` — blocking (`topology_routes.py:33-44`)
- `GET /api/topology/refresh-stream` — SSE streaming (`:47-102`)

Both call `topology_service.refresh_topology()` (`topology_service.py:307-342`).

### 2. Run CDP collection playbook

**File:** `topology_service.py:307-317`

```python
async def refresh_topology():
    cmd = get_podman_command("getCDPNeighbors.yml")  # :309
    # Runs podman exec sentry-ansible ansible-playbook getCDPNeighbors.yml
    proc = await asyncio.create_subprocess_exec(*cmd, ...)  # :310-314
    stdout, _ = await proc.communicate()  # :315
```

The `getCDPNeighbors.yml` playbook runs `show cdp neighbors detail` (or `show cdp neighbors` as fallback) on each device and saves output to `watchman/playbooks/cdp_output/<hostname>.txt`.

### 3. Parse CDP output

**File:** `topology_service.py:139-152`

```python
def parse_all_cdp_files() -> List[dict]:
    for fpath in sorted(CDP_OUTPUT_DIR.glob("*.txt")):  # :145
        device_name = fpath.stem  # :146 (filename without .txt)
        text = fpath.read_text()  # :147
        records = parse_cdp_output(device_name, text)  # :148
        all_records.extend(records)
```

Two formats supported:

**A. Detail format** (`:29-51`) — `show cdp neighbors detail`
- Multi-entry format separated by `-------------------------`
- Regex extracts: `Device ID`, `IP address`, `Platform`, `Capabilities`, `Interface`, `Port ID (outgoing port)`
- Returns: `{source_device, source_interface, target_device, target_interface, target_platform, target_capabilities, target_ip}`

**B. Brief format** (`:80-100`) — `show cdp neighbors` (table)
- Table columns: `Device ID`, `Local Intrfce`, `Holdtme`, `Capability`, `Platform`, `Port ID`
- Capability abbreviations expanded via `_CAPABILITY_MAP` (`:58-67`): `R`→Router, `S`→Switch, etc.
- Returns same structure but without `target_ip`

### 4. Build topology graph

**File:** `topology_service.py:234-276`

First, **BFS tier discovery** (`:169-229`):
- Builds adjacency map from neighbor records (`:170-184`)
- Identifies edge devices: any device with `Router` capability (`:186-189`)
- BFS from edge devices outward:
  - Depth 1 → `core` (`:212`)
  - Depth 2 → `distribution` (`:213-214`)
  - Depth 3+ → `access` (`:215-216`)
- Hardcoded overrides in `DEVICE_TIER` (`:159-166`) take priority over BFS

Then **graph construction** (`:234-276`):
- Creates node objects with `{id, label, tier, ip, platform}` (`:246-260`)
- Creates edge objects with `{id, source, target, source_interface, target_interface}` (`:265-271`)
- Deduplicates edges using sorted tuple set (`:262-264`)
- Sorts nodes by tier order: edge → core → distribution → access (`:274`)

### 5. Store to MongoDB

**File:** `topology_service.py:281-303`

Two collections:
- `cdp_neighbors` — raw neighbor records, replaced on each refresh (`:282-288`)
- `topology_cache` — current graph state, upserted with `_id: "current"` (`:292-294`)

### 6. Frontend fetches graph

**File:** `frontend/src/pages/TopologyMap.jsx`

Calls `GET /api/topology/graph` which returns `{nodes: [...], edges: [...], last_refreshed: ...}` from `topology_cache` collection.

Renders with React Flow (`@xyflow/react`) with:
- Tier-based node positioning (edge at top, access at bottom)
- Clickable nodes with detail panel
- Edge labels showing interface names
- Search/highlight

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/topology_routes.py` | 1-102 | GET/POST/SSE endpoints |
| `watchman/app/services/topology_service.py` | 112-136 | CDP detail/brief parser |
| `watchman/app/services/topology_service.py` | 139-152 | Multi-file batch parser |
| `watchman/app/services/topology_service.py` | 169-229 | BFS tier discovery |
| `watchman/app/services/topology_service.py` | 234-276 | Graph builder (nodes + edges) |
| `watchman/app/services/topology_service.py` | 281-303 | MongoDB storage |
| `watchman/app/services/topology_service.py` | 307-342 | Orchestration |
| `watchman/playbooks/getCDPNeighbors.yml` | — | Ansible playbook |
| `watchman/playbooks/cdp_output/` | — | Output file directory |
| `frontend/src/pages/TopologyMap.jsx` | — | React Flow topology map |
| `frontend/src/components/TopoPanel.jsx` | — | Device detail panel |

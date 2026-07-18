# Playbook Execution Flow

## Diagram

```
┌─────────────────────────┐     POST /playbooks/execute      ┌───────────────────────── ┐
│  PlaybookManagement.jsx │     {playbook_name: "ospf.yml"}  │     watchman container   │
│  :67-84 ("Run" button)  │ ────────────────────────────────▶│  playbook_routes.py      │
│                         │                                  │  :23-57                  │
│  Also via:              │                                  │                          │
│  AiChat.jsx (suggest)   │                                  │  execution_service.py    │
│  PlaybookSuggestions.jsx│                                  │  :69-72                  │
│  :35-41                 │                                  │    run_playbook()        │
└─────────────────────────┘                                  │      get_podman_cmd():18 │
                                                             │      _run_podman():50    │
                                                             └──────────┬────────────── ┘
                                                                        │ podman run --rm
                                                                        │ --network=host
                                                                        │ -v playbooks:/ansible
                                                                        │ localhost/sentry-ansible
                                                                        │ ansible-playbook ...
                                                                        ▼
                                                             ┌─────────────────────────┐
                                                             │   sentry-ansible        │
                                                             │   (ephemeral container) │
                                                             │   ansible-playbook      │
                                                             │   ospf.yml              │
                                                             │   -i hosts.ini          │
                                                             │   cisco.ios collection  │
                                                             └─────────────────────────┘
                                                                        │
                                                                        │ stdout + stderr
                                                                        ▼
                                                             ┌─────────────────────────┐
                                                             │   Back to watchman      │
                                                             │   returncode, output    │
                                                             │                         │
                                                             │   1. Audit log written  │
                                                             │      playbook_routes.py │
                                                             │      :30-43             │
                                                             │                         │
                                                             │   2. Response sent back │
                                                             │      PlaybookResponse   │
                                                             │      :45-50             │
                                                             └─────────────────────────┘
```

## Step-by-step

### 1. User triggers execution

**Two entry points:**

**A. PlaybookManagement page** — `frontend/src/pages/PlaybookManagement.jsx:67-84`
- User clicks the "Run" button in the playbook table (`:283-291`)
- Calls `handleRunPlaybook(rowId, playbook.name)` at `:67`
- Sets loading spinner state for that row (`:69`)
- Calls `executePlaybook(name)` from `inventoryService.js:36-44`
- On success: updates pipeline status to "Verified" via `updatePlaybookStatus(id, "Verified")` (`:72-73`)
- On failure: updates to "Failed" (`:72-73`)
- Shows success/error banner (`:74-80`)

**B. AI Chat** — `frontend/src/components/PlaybookSuggestions.jsx:35-41`
- After AI suggests matching playbooks, user clicks "Run" on a suggestion card
- Triggers the same `POST /playbooks/execute` endpoint

### 2. API call

**File:** `frontend/src/services/inventoryService.js:36-44`

```javascript
const response = await api.post("/playbooks/execute", {
    playbook_name: playbookName
});
```

Uses the centralized `api` axios instance (`services/api.js`), which adds `Authorization: Bearer <token>` header.

### 3. Backend receives request

**File:** `watchman/app/routes/playbook_routes.py:23-57`

- `:24` — `async def execute_playbook(request: PlaybookRequest)` receives `{"playbook_name": "ospf.yml"}`
- `:27` — Delegates to `execution_service.run_playbook(request.playbook_name)`
- `:30-43` — Records audit log entry to MongoDB `audit_logs` collection:
  - `:33` — `action_name: "playbook_execute"`
  - `:34` — `playbook_name`
  - `:35` — `status: "success"` if returncode 0, else `"failed"`
  - `:36` — Full `output` captured
  - `:37` — `username` from request (or `"ChatConsole"` if not provided)
- `:45-50` — Returns `PlaybookResponse` with status, playbook_name, message, output

### 4. Execution service runs the playbook

**File:** `watchman/app/services/execution_service.py:69-72`

```python
def run_playbook(playbook_name: str) -> Tuple[int, str]:
    validate_playbook_path(playbook_name)  # :60-66
    cmd = get_podman_command(playbook_name)  # :18-30
    return _run_podman(cmd)  # :50-57
```

### 4a. Path validation (`:60-66`)
- Checks the `.yml`/`.yaml` file exists in `watchman/playbooks/`
- Rejects non-`.yml`/`.yaml` files
- Returns 404 if file not found

### 4b. Podman command construction (`:18-30`)

```python
def get_podman_command(playbook_name: str) -> List[str]:
    # Builds: podman run --rm --pull=never --network=host
    #         -v /abs/path/to/playbooks:/ansible:Z
    #         localhost/sentry-ansible
    #         ansible-playbook /ansible/<playbook_name>
    #         -i /ansible/hosts.ini
```

Key details:
- `:21` — `--rm`: container removed after execution
- `:22` — `--pull=never`: never try to pull from registry (image must exist locally)
- `:23` — `--network=host`: container shares host network (necessary for SSH to lab devices)
- `:24` — Volume mount with `:Z` (SELinux context) on Linux
- `:27` — Ansible playbook command with inventory file `hosts.ini`

### 4c. Execution (`:50-57`)

```python
def _run_podman(cmd: List[str], timeout: int = 300) -> Tuple[int, str]:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout + result.stderr
```

- `subprocess.run` with 300-second (5 minute) timeout
- Captures both stdout and stderr combined
- On timeout: returns HTTP 408
- On missing Podman: returns HTTP 500

### 5. sentry-ansible container executes playbook

Inside the container (`Dockerfile.ansible`):
- Ansible connects to devices via SSH using credentials from `hosts.ini`
- Uses `cisco.ios` collection for IOS commands
- Legacy SSH ciphers enabled for older Cisco gear (diffie-hellman-group1-sha1, ssh-rsa)
- `host_key_checking = False` per `ansible.cfg`
- Output goes to stdout line by line

### 6. Non-blocking variant: SSE streaming

**File:** `playbook_routes.py:59-80`

For real-time output during long playbooks, use `GET /playbooks/execute-stream/{playbook_name}`:

```
Frontend connects to SSE endpoint
    → execution_service.run_playbook_stream_generator():75-96
        → subprocess.Popen with piped stdout
        → yields SSE events: data: {"type": "output", "line": "..."}
        → final event: data: {"type": "complete", "status": "success/failed"}
    → StreamingResponse with media_type="text/event-stream"
```

Used by components like `RefreshFactsModal.jsx` and `PlaybookStagingGate.jsx` for real-time progress.

### 7. Response returned

The frontend receives the response and:
- Updates pipeline status to "Verified" (success) or "Failed" (error)
- Shows a success/error banner
- Refreshes the playbook dashboard metrics (`fetchMetrics()` at `:82`)

## Failure modes

| What breaks | Symptom | Root cause |
|---|---|---|
| `sentry-ansible` image not found | "Podman execution timeout" or error 500 | `entrypoint.sh:12-24` tries to load from `.tar`; if tar missing too, container not found |
| SSH connection fails | Ansible task fails in output | Wrong credentials in `hosts.ini`; device unreachable; legacy cipher not enabled |
| Playbook file missing | HTTP 404 | File deleted or name mismatch |
| Podman not installed | HTTP 500 "Podman not found in PATH" | Missing dependency on host |
| 300s timeout | HTTP 408 | Playbook takes > 5 minutes; increase `timeout` in `execution_service.py:50` |
| SELinux blocks volume mount | Podman error | Missing `:Z` suffix; or host SELinux policy blocks container |

## SSE streaming variant

| Endpoint | When used | Frontend consumer |
|---|---|---|
| `GET /playbooks/execute-stream/{name}` | Long-running playbooks with real-time UI | `RefreshFactsModal.jsx`, `PlaybookStagingGate.jsx` |
| `POST /playbooks/execute` | Quick playbooks (blocking) | `PlaybookManagement.jsx`, `AiChat.jsx` |

## Key files

| File | Lines | Role |
|---|---|---|
| `watchman/app/routes/playbook_routes.py` | 23-57 | Blocking execute endpoint |
| `watchman/app/routes/playbook_routes.py` | 59-80 | SSE streaming execute endpoint |
| `watchman/app/services/execution_service.py` | 18-30, 50-57, 69-72 | Podman command building, execution, validation |
| `watchman/app/services/execution_service.py` | 75-96 | SSE stream generator |
| `watchman/app/models/playbook.py` | 5-13 | PlaybookRequest/Response schemas |
| `watchman/scripts/entrypoint.sh` | 1-26 | Container startup; loads sentry-ansible image |
| `frontend/src/pages/PlaybookManagement.jsx` | 67-84 | "Run" button handler |
| `frontend/src/services/inventoryService.js` | 36-44 | API call wrapper |
| `frontend/src/components/PlaybookSuggestions.jsx` | 1-59 | AI suggestion cards with Run button |
| `frontend/src/components/PlaybookModal.jsx` | 1-253 | Add/edit playbook form |

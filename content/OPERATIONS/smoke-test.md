# Smoke Test

**File:** `watchman/scripts/smoke_test.py`

## Usage

```bash
# Full test (all checks)
python watchman/scripts/smoke_test.py

# Skip nmap scan + frontend server check
python watchman/scripts/smoke_test.py --quick

# Test only the backend
python watchman/scripts/smoke_test.py --backend-only

# Test only the frontend
python watchman/scripts/smoke_test.py --frontend-only

# Run the setup check
python watchman/scripts/smoke_test.py --setup
```

## What it checks

| Check | --quick | --backend-only | --frontend-only |
|---|---|---|---|
| Backend API live (`GET /`) | ✅ | ✅ | ❌ |
| Backend endpoints respond | ✅ | ✅ | ❌ |
| sentry-ansible container exists | ✅ | ✅ | ❌ |
| sentry-ansible collections installed | ✅ | ✅ | ❌ |
| Nmap scan runs | ❌ | ✅ | ❌ |
| Frontend dev server responds | ❌ | ❌ | ✅ |
| Frontend build succeeds | ❌ | ❌ | ✅ |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All checks passed |
| 1 | One or more checks failed |

## Troubleshooting failures

| Failure | Likely cause |
|---|---|
| Backend not live | Watchman container not running; check `podman-compose ps` |
| sentry-ansible missing | Run `container_manager.py build` |
| Collections missing | Rebuild the sentry-ansible container |
| Nmap fails | Nmap not installed on host or timeout |
| Frontend not responding | Dev server not running or wrong port |

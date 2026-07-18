# Development Setup

## Backend

```bash
cd watchman
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Start with hot-reload:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Environment:** Copy `watchman/.env` with your settings (or use the provided one).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`.

**API proxy:** The dev server uses `VITE_API_BASE_URL` (defaults to `http://127.0.0.1:8000`). The watchman backend must be running on port 8000.

## Building the Ansible container

```bash
python watchman/scripts/container_manager.py build
```

## Running playbooks locally (dev)

```bash
python watchman/scripts/container_manager.py run <playbook.yml>
```

## Interactive shell in sentry-ansible

```bash
python watchman/scripts/container_manager.py shell
```

## Getting logs

```bash
podman-compose logs -f watchman
podman-compose logs -f syslog-ng
```

## Running smoke tests

```bash
python watchman/scripts/smoke_test.py              # full test
python watchman/scripts/smoke_test.py --quick       # skip nmap + frontend
python watchman/scripts/smoke_test.py --backend-only
python watchman/scripts/smoke_test.py --frontend-only
```

## Linting

```bash
cd frontend && npm run lint
```

No formatter (Prettier config exists but no Black/ruff for Python).

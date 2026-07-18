# Quickstart

## Prerequisites

- Podman (with podman-compose)
- Python 3.11+
- Node.js 20+
- Git

## 1. Clone

```bash
git clone <repo-url> Sentry-Pod
cd Sentry-Pod
```

## 2. Build the sentry-ansible container

```bash
python watchman/scripts/container_manager.py build
```

This builds the `localhost/sentry-ansible` image with `cisco.ios` collection and legacy SSH ciphers.

## 3. Start the stack

```bash
podman-compose up
```

This starts four containers:
- `watchman` (FastAPI, port 8000)
- `command-center` (React/nginx, port 3000)
- `syslog-ng` (syslog capture, port 10514/udp)
- `vault` (MongoDB, port 27017) — optional, Atlas is default

## 4. Verify

```bash
python watchman/scripts/smoke_test.py
```

Or check individual services:
- `curl http://localhost:8000/` → `{"message":"Sentry-Pod API is live"}`
- Open `http://localhost:3000` in browser

## 5. Setup wizard

1. Open `http://localhost:3000` (or `http://localhost:5173` for dev mode)
2. Click "Set Up Network" or navigate to `/setup`
3. Follow the 5-step wizard to add your devices
4. Apply the configuration

## 6. Set up HuggingFace API key (for AI chat)

- Via UI: Settings → API Key → enter key
- Via env var: set `HUGGINGFACE_API_KEY` in `watchman/.env`

## Next steps

- [Development setup](development.md)
- [Production deployment](production.md)
- [Configuration reference](configuration.md)

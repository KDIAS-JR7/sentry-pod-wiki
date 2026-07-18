# Dockerfiles Reference

## watchman/Dockerfile (20 lines)

**Purpose:** FastAPI backend container with Python 3.11, nmap, Podman.

| Line | Instruction | Detail |
|---|---|---|
| 2 | `FROM python:3.11-slim` | Minimal Python base |
| 4 | `WORKDIR /app` | Application directory |
| 6 | `RUN apt-get install -y nmap podman` | Dependencies for scanning + container mgmt |
| 7-9 | Configure Podman VFS storage driver | Required because overlay not available inside container |
| 11 | `COPY requirements.txt .` | Python dependencies |
| 12 | `RUN pip install -r requirements.txt` | Install deps |
| 14-16 | `COPY . .` + entrypoint | Copy app code and entrypoint script |
| 18 | `EXPOSE 8000` | API port |
| 20 | `ENTRYPOINT ["/entrypoint.sh"]` | Startup script |

## watchman/Dockerfile.syslog-ng (15 lines)

**Purpose:** Syslog-ng container for centralized log collection.

| Line | Instruction | Detail |
|---|---|---|
| 1 | `oooFROM ubuntu:24.04` | **Typo:** `oooFROM` → `FROM` |
| 5 | `apt-get install -y syslog-ng curl` | Dependencies |
| 9 | `COPY gns3_lab.conf` | syslog-ng config |
| 10-11 | `COPY syslog_listener.sh + chmod` | Parser script |
| 13 | `EXPOSE 10514/udp` | Syslog port |
| 15 | `CMD ["syslog-ng", "-F", ...]` | Run in foreground |

## frontend/Dockerfile.prod (12 lines)

**Purpose:** Multi-stage production build for React frontend.

| Line | Stage | Instruction | Detail |
|---|---|---|---|
| 1 | build | `FROM node:20-alpine` | Node build stage |
| 2-3 | build | `WORKDIR /app`, `COPY package*.json` | Dependencies |
| 4 | build | `RUN npm ci` | Clean install |
| 5-6 | build | `COPY . .`, `RUN npm run build` | Full production build |
| 8 | serve | `FROM nginx:alpine` | Nginx serve stage |
| 9 | serve | `COPY --from=build /app/dist` | Compiled assets |
| 10 | serve | `COPY nginx.conf` | Custom config |
| 11-12 | serve | `EXPOSE 80`, `CMD nginx` | Run nginx |

## watchman/Dockerfile.ansible

**Purpose:** Ansible runner with Cisco IOS support.

Used by `container_manager.py build`. Contains:
- Python + Ansible
- `cisco.ios` Ansible collection
- Legacy SSH cipher config (diffie-hellman-group1-sha1, ssh-rsa)
- `ansible.cfg` with host_key_checking=False
- `run_action.sh` script for drift/baseline operations

## Key differences

| Dockerfile | Base | Size | Purpose |
|---|---|---|---|
| `watchman/Dockerfile` | python:3.11-slim | ~500MB | API backend |
| `Dockerfile.syslog-ng` | ubuntu:24.04 | ~250MB | Syslog capture |
| `frontend/Dockerfile.prod` | node:20-alpine → nginx:alpine | ~50MB | React UI |
| `Dockerfile.ansible` | (varies) | ~800MB | Ansible runner |

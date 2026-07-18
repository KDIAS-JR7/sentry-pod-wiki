# Dependencies

## Python (watchman/requirements.txt)

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | 0.136.3 | Web framework |
| `uvicorn` | 0.49.0 | ASGI server |
| `starlette` | 1.2.1 | ASGI toolkit |
| `pydantic` | 2.13.4 | Data validation |
| `pydantic-settings` | 2.14.1 | Settings from .env |
| `motor` | 3.7.1 | Async MongoDB driver |
| `pymongo` | 4.17.0 | Sync MongoDB driver |
| `httpx` | 0.28.1 | HTTP client (HF API) |
| `python-jose` | 3.5.0 | JWT encode/decode |
| `passlib` | 1.7.4 | Password hashing |
| `bcrypt` | 4.0.1 | Password hash algorithm |
| `python-dotenv` | 1.2.2 | .env file loading |
| `websockets` | 16.0 | WebSocket support |
| `python-multipart` | 0.0.32 | Form data parsing |
| `PyYAML` | 6.0.3 | YAML parsing |
| `email-validator` | 2.3.0 | Email validation |
| `asyncssh` | 2.23.0 | Async SSH terminal |
| `pyOpenSSL` | 21.0.0 | SSL/TLS |
| `cryptography` | 43.0.0 | Crypto primitives |
| `certifi` | 2026.5.20 | TLS CA bundle |
| `anyio` | 4.13.0 | Async runtime |
| `click` | 8.4.1 | CLI utilities |
| `h11` | 0.16.0 | HTTP/1.1 |
| `httpcore` | 1.0.9 | HTTP transport |
| `idna` | 3.18 | International domain names |
| `sniffio` | — | Async detection |
| `typing_extensions` | 4.15.0 | Type hints |

## JavaScript (frontend/package.json)

### Runtime

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.0 | UI framework |
| `react-dom` | ^19.2.0 | DOM renderer |
| `react-router-dom` | ^7.13.1 | Client routing |
| `axios` | ^1.16.0 | HTTP client |
| `@xyflow/react` | ^12.11.0 | Interactive topology graph |
| `@xterm/xterm` | ^5.5.0 | Terminal emulator |
| `@xterm/addon-fit` | ^0.10.0 | Terminal auto-fit |
| `recharts` | ^3.8.1 | Charts |
| `lucide-react` | ^0.577.0 | Icons |
| `jwt-decode` | ^4.0.0 | JWT payload reading |
| `tailwindcss` | ^4.2.1 | CSS framework |
| `@tailwindcss/vite` | ^4.2.1 | Tailwind Vite plugin |

### Dev

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^7.3.1 | Build tool |
| `@vitejs/plugin-react` | ^5.1.1 | React integration |
| `eslint` | ^9.39.1 | Linter |
| `eslint-plugin-react` | ^7.37.5 | React lint rules |
| `eslint-plugin-react-hooks` | ^7.0.1 | Hooks lint rules |
| `eslint-plugin-react-refresh` | ^0.4.24 | HMR lint |
| `globals` | ^16.5.0 | ESLint globals |
| `@types/react` | ^19.2.7 | React type definitions |
| `@types/react-dom` | ^19.2.3 | React DOM types |

## System dependencies (host)

| Package | Purpose |
|---|---|
| `podman` | Container runtime |
| `podman-compose` | Multi-container orchestration |
| `nmap` | Network ping scanning |
| `snmpbulkwalk` (net-snmp-utils) | SNMP data collection |
| `python3` | Backend runtime |
| `nodejs` | Frontend build |

## Ansible (inside sentry-ansible container)

| Component | Purpose |
|---|---|
| `ansible-core` | Automation engine |
| `cisco.ios` collection | Cisco IOS modules |
| `paramiko` | SSH transport |
| `ssh legacy ciphers` | Compatibility with older IOS |

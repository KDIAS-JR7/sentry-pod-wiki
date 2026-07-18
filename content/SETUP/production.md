# Production Deployment

## Prerequisites

- Podman + podman-compose on the target host
- Network access to target devices (SSH, SNMP, syslog)
- MongoDB Atlas account (or local vault)
- HuggingFace API key (for AI features)
- DNS resolution or `/etc/hosts` entries for lab devices

## Full stack deployment

```bash
# 1. Build the Ansible runner
python watchman/scripts/container_manager.py build

# 2. Start everything
podman-compose up -d

# 3. Check status
podman-compose ps
```

## Service ports

| Service | Port | Access |
|---|---|---|
| watchman | 8000 | Internal / reverse proxy |
| command-center | 3000 (mapped to container 80) | User-facing |
| syslog-ng | 10514/udp | Device syslog destination |
| vault | 27017 | Internal only |

## Security considerations

### JWT secret
Generate a strong secret:
```bash
curl -X POST http://localhost:8000/setup/generate-secret
```
Or set `SECRET_KEY` in `watchman/.env`.

### MongoDB credentials
Change `Admin123` in `podman-compose.yaml:10` and `watchman/.env` before production use.

### CORS
Edit `watchman/app/core/config.py:46-50` to restrict origins to your domain.

### nginx security headers
The production frontend (`frontend/nginx.conf`) includes:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` restricting `connect-src`

Adjust the CSP in `frontend/nginx.conf:14` to match your API domain.

## SSL/TLS

Not configured in the compose stack. Recommended setup:
- Place a reverse proxy (nginx/caddy/traefik) in front of command-center
- Use Let's Encrypt for certificates
- Configure watchman behind the same proxy or use internal networking

## Scaling considerations

- Watchman is single-process (uvicorn); scale with multiple workers via gunicorn
- MongoDB Atlas handles connection pooling
- The sentry-ansible container runs ephemerally — no scaling needed

## Monitoring

- Docker health checks are not configured in the compose file
- Use `smoke_test.py` as a cron job for periodic health checks
- Watchman logs to stdout (captured by podman-compose logs)

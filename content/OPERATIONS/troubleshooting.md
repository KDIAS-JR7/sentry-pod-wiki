# Troubleshooting

## Common issues

| Symptom | Likely cause | Solution |
|---|---|---|
| Backend won't start | MongoDB URI invalid | Check `MONGO_URI` or `DB_USER`/`DB_PASS`/`DB_HOST` in `.env` |
| "Podman not found" | Podman not installed on host | `apt install podman` or equivalent |
| Playbook execution fails silently | `sentry-ansible` image not loaded | Run `container_manager.py build` or check `entrypoint.sh` |
| "Could not validate credentials" | JWT expired (120 min) | Log in again (no refresh mechanism) |
| Login returns 401 | Wrong username/password | Check MongoDB users collection |
| CORS error in browser | Origin not in `BACKEND_CORS_ORIGINS` | Add origin to `config.py:46-50` |
| Syslog alerts not appearing | Listener not receiving | Check syslog-ng container status; `podman-compose logs syslog-ng` |
| Syslog shows bare IPs | `hosts.ini` missing | Run setup wizard or populate hosts.ini |
| "Host key verification failed" | `host_key_checking` not disabled | Check `ansible.cfg` has `host_key_checking = False` |
| SSH timeout | Legacy cipher not enabled | Rebuild sentry-ansible with `diffie-hellman-group1-sha1` support |
| Frontend shows white screen | API unreachable or JS error | Check browser console; ensure watchman is running |
| API returns 500 | Internal server error | Check `podman-compose logs watchman` |
| Baseline refresh fails | No devices in hosts.ini | Verify hosts.ini has device entries |
| "Total Devices Baselined: 0" | SSH connection failure | Check credentials in hosts.ini; device reachability |
| HF API returns 503 | Model overloaded | Retry later or switch model in settings |
| Container "vault" not used | Atlas is default | See [COMPONENTS/vault.md](../COMPONENTS/vault.md) for switch procedure |
| `docker` command used instead of `podman` | Leftover from development | All commands must use Podman |
| SELinux volume mount errors | Missing `:Z` flag | Volume mounts use `:Z` on Linux (`execution_service.py:24`) |
| `--pull=never` error | Image missing locally | Load image via `container_manager.py build` or tar |

## Log locations

| Service | Log source | Command |
|---|---|---|
| watchman | Container stdout | `podman-compose logs watchman` |
| watchman | Uvicorn stdout | Runs with `--limit-concurrency 100` |
| syslog-ng | Container stdout | `podman-compose logs syslog-ng` |
| syslog-ng | Archived logs | `/var/log/syslog/<hostname>/debug.log` (inside container) |
| Ansible | Playbook output | Captured in API response / SSE stream |
| Frontend | Browser console | DevTools → Console |
| Frontend | Vite dev server | Terminal running `npm run dev` |

## Debugging playbooks

```bash
# Run with verbose output
python watchman/scripts/container_manager.py run playbook.yml
# or directly:
podman run --rm localhost/sentry-ansible ansible-playbook /ansible/playbook.yml \
  -i /ansible/hosts.ini -vvv

# Check collected facts
cat watchman/playbooks/facts/<device>.json

# Check drift files
cat watchman/playbooks/configDrift/DRIFT_<hostname>.diff
```

## Resetting

```bash
# Reset everything
podman-compose down
podman-compose rm -f
podman volume rm vault-data
python watchman/scripts/container_manager.py build
podman-compose up
```

To clear MongoDB data without losing the container:
```bash
# Via API
curl -X DELETE http://localhost:8000/api/syslog/alerts

# Via setup wizard flush (reapplies)
POST /setup/apply with flush_mongo=true, flush_disk=true
```

# Maintenance

## Data cleanup

### Clear syslog alerts
```bash
curl -X DELETE http://localhost:8000/api/syslog/alerts
```

### Clear drift files
```bash
rm watchman/playbooks/configDrift/DRIFT_*.diff
```

### Reset golden state baselines
```bash
rm watchman/playbooks/goldenState/GS_*.txt
# Then re-run baseline collection via Dashboard
```

### Clear all playbook output
```bash
python watchman/scripts/cleanup_data.py
```

## Container maintenance

### Rebuild sentry-ansible
```bash
python watchman/scripts/container_manager.py build
```

### Rebuild watchman
```bash
podman-compose build watchman
podman-compose up -d watchman
```

### Full container restart
```bash
podman-compose down
podman-compose up -d
```

## MongoDB maintenance

### Backup (via mongodump)
```bash
podman exec <mongo-container> mongodump --username sentry_pod \
  --password Admin123 --db sentry_pod_db --out /tmp/backup
```

### Sync from Atlas to local (after switching)
```bash
python watchman/scripts/sync_users.py
```

## Updating dependencies

### Python
```bash
cd watchman
source .venv/bin/activate
pip install --upgrade -r requirements.txt
```

### JavaScript
```bash
cd frontend
npm update
```

### Ansible collections (inside sentry-ansible)
```bash
python watchman/scripts/container_manager.py shell
ansible-galaxy collection install cisco.ios --upgrade
```

## Disk space

Key directories to watch:
- `watchman/playbooks/snmp_output/` — grows with each SNMP collect
- `watchman/nmap_output/` — replaced each scan
- `watchman/playbooks/configDrift/` — one file per device with drift
- `nmap_output/` — root-level nmap results
- `snmp_output/` — root-level SNMP results
- `vault-data` volume — MongoDB local storage (if using local vault)

## Health checks (recommended cron)

```bash
# Daily smoke test
0 6 * * * cd /path/to/Sentry-Pod && python watchman/scripts/smoke_test.py --quick >> /var/log/sentry-pod-health.log 2>&1
```

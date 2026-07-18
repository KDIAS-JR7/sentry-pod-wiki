# Sentry-Pod

Containerized Network Management System for Cisco-centric networks. FastAPI backend + React/Vite UI + MongoDB + Ansible in Podman.

## Architecture at a glance

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│   Browser   │────▶│  command-center  │     │    vault      │
│ :5173/:3000 │     │  nginx + React   │     │  MongoDB      │
└─────────────┘     ├──────────────────┤     │  :27017       │
                    │  Dockerfile.prod │     ├───────────────┤
                    │  nginx.conf:1-24 │     │ Local (opt)   │
                    └────────┬─────────┘     │ or Atlas      │
                             │               └───────────────┘
                             │ HTTP :8000          ▲
                             ▼                     │
┌─────────────────────────────────────────┐        │
│              watchman                   │────────┘
│  FastAPI + motor (async MongoDB)        │  MongoDB driver
│  :8000                                  │
│  ┌──────────────────────────────────┐   │
│  │  12 route modules (main.py:33-45)│   │
│  │  7 service modules               │   │
│  │  3 model modules                 │   │
│  └──────────────────────────────────┘   │
└────┬────────────────────────────────────┘
     │ podman exec              │ UDP :10514
     ▼                          ▼
┌────────────────┐    ┌──────────────────┐
│ sentry-ansible │    │    syslog-ng     │
│ Ansible runner │    │  syslog capture  │
│ (ephemeral)    │    ├──────────────────┤
│ cisco.ios coll.│    │ syslog_listener  │
│ legacy ciphers │    │  → POST /api/    │
└────────────────┘    └──────────────────┘
```

## Quick links

| Area | Doc |
|---|---|
| **Architecture deep-dive** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **End-to-end flows** | |
| Syslog pipeline | [FLOWS/syslog-pipeline.md](FLOWS/syslog-pipeline.md) |
| Playbook execution | [FLOWS/playbook-execution.md](FLOWS/playbook-execution.md) |
| Configuration drift | [FLOWS/configuration-drift.md](FLOWS/configuration-drift.md) |
| CDP topology discovery | [FLOWS/cdp-topology-discovery.md](FLOWS/cdp-topology-discovery.md) |
| Network baselines | [FLOWS/network-baselines.md](FLOWS/network-baselines.md) |
| AI chat session | [FLOWS/ai-chat-session.md](FLOWS/ai-chat-session.md) |
| Device status algorithm | [FLOWS/device-status-algorithm.md](FLOWS/device-status-algorithm.md) |
| Authentication flow | [FLOWS/authentication-flow.md](FLOWS/authentication-flow.md) |
| Refresh facts | [FLOWS/refresh-facts.md](FLOWS/refresh-facts.md) |
| Onboarding wizard | [FLOWS/onboarding-wizard.md](FLOWS/onboarding-wizard.md) |
| **Component reference** | |
| Watchman (backend) | [COMPONENTS/watchman.md](COMPONENTS/watchman.md) |
| Frontend | [COMPONENTS/frontend.md](COMPONENTS/frontend.md) |
| Ansible subsystem | [COMPONENTS/ansible.md](COMPONENTS/ansible.md) |
| Vault (MongoDB) | [COMPONENTS/vault.md](COMPONENTS/vault.md) |
| Syslog-ng | [COMPONENTS/syslog-ng.md](COMPONENTS/syslog-ng.md) |
| **Operations** | |
| Container management | [OPERATIONS/container-management.md](OPERATIONS/container-management.md) |
| Smoke test | [OPERATIONS/smoke-test.md](OPERATIONS/smoke-test.md) |
| Troubleshooting | [OPERATIONS/troubleshooting.md](OPERATIONS/troubleshooting.md) |
| All scripts reference | [OPERATIONS/scripts-reference.md](OPERATIONS/scripts-reference.md) |
| Maintenance | [OPERATIONS/maintenance.md](OPERATIONS/maintenance.md) |
| **Setup** | |
| Quickstart | [SETUP/quickstart.md](SETUP/quickstart.md) |
| Development | [SETUP/development.md](SETUP/development.md) |
| Production | [SETUP/production.md](SETUP/production.md) |
| Configuration | [SETUP/configuration.md](SETUP/configuration.md) |
| **Reference** | |
| Glossary | [REFERENCE/glossary.md](REFERENCE/glossary.md) |
| Dockerfiles | [REFERENCE/dockerfiles.md](REFERENCE/dockerfiles.md) |
| Dependencies | [REFERENCE/dependencies.md](REFERENCE/dependencies.md) |
| Changelog | [REFERENCE/changelog.md](REFERENCE/changelog.md) |

## Key stats

| Metric | Value |
|---|---|
| Backend routes | 12 route modules, ~7 services |
| Frontend pages | 17 pages, 30+ components |
| Ansible playbooks | 22 |
| MongoDB collections | 8 |
| Podman containers | 4 compose services + 1 ephemeral runner |
| Python deps | ~26 runtime packages |
| JS deps | ~9 runtime packages |

## Known issues (tracked in flows)

- `Dockerfile.syslog-ng:1` — typo `oooFROM` instead of `FROM` (Docker ignores it but technically malformed)
- `syslog_listener.sh` is copied into the syslog-ng container but **not launched** by the CMD — must be started manually or via a separate process supervisor
- JWT tokens expire after 120 minutes (`config.py:41`) with no refresh mechanism in the frontend

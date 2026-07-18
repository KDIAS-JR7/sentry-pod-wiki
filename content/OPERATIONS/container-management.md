# Container Management

## `container_manager.py`

**File:** `watchman/scripts/container_manager.py`

Unified CLI for managing the `sentry-ansible` Podman container.

### Commands

| Command | Description |
|---|---|
| `build` | Build the `sentry-ansible` image from `Dockerfile.ansible` |
| `up` | Start all compose services (alias for `podman-compose up -d`) |
| `down` | Stop all compose services |
| `status` | Show container status |
| `run <playbook>` | Execute a playbook inside the sentry-ansible container |
| `shell` | Open an interactive bash shell inside the container |
| `check` | Verify the setup (image exists, collections installed) |

### Usage examples

```bash
# Build the Ansible runner
python watchman/scripts/container_manager.py build

# Run a playbook
python watchman/scripts/container_manager.py run ospf.yml

# Interactive shell
python watchman/scripts/container_manager.py shell

# Check everything is set up
python watchman/scripts/container_manager.py check
```

## podman-compose

**File:** `podman-compose.yaml`

| Command | Effect |
|---|---|
| `podman-compose up` | Start all 4 services |
| `podman-compose up -d` | Start in detached mode |
| `podman-compose down` | Stop all services |
| `podman-compose logs -f <service>` | Follow logs for a service |
| `podman-compose restart <service>` | Restart a single service |

## Manual podman commands

```bash
# Run a playbook directly
podman run --rm --pull=never --network=host \
  -v /path/to/playbooks:/ansible:Z \
  localhost/sentry-ansible \
  ansible-playbook /ansible/ospf.yml -i /ansible/hosts.ini

# Interactive shell
podman run -it --rm --pull=never --network=host \
  -v /path/to/playbooks:/ansible:Z \
  localhost/sentry-ansible /bin/bash
```

## SL status check

```bash
podman-compose ps
podman images | grep sentry
podman ps -a | grep sentry
```

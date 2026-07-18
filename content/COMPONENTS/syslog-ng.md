# Syslog-ng

## Overview

The syslog-ng container receives syslog messages from network devices via UDP, archives them to disk, and forwards them to the Watchman API via a shell script for display in the Dashboard.

## Container

**Defined in:** `podman-compose.yaml:26-37`

- Image: built from `./watchman/Dockerfile.syslog-ng`
- Port: `10514/udp`
- Volumes:
  - `gns3_lab.conf` → `/etc/syslog-ng/conf.d/gns3_lab.conf`
  - `syslog_listener.sh` → `/usr/local/bin/syslog_listener.sh`
  - `playbooks/syslog/` → `/var/log/syslog/` (for archived logs)

## Dockerfile

**File:** `watchman/Dockerfile.syslog-ng:1-15`

| Line | Content |
|---|---|
| 1 | `oooFROM ubuntu:24.04` — **typo:** `oooFROM` should be `FROM`. Docker may reject this. |
| 5 | `apt-get install -y syslog-ng curl` |
| 9 | Copy `gns3_lab.conf` to syslog-ng conf dir |
| 10-11 | Copy + chmod `syslog_listener.sh` |
| 13 | `EXPOSE 10514/udp` |
| 15 | `CMD ["syslog-ng", "-F", "-f", "/etc/syslog-ng/syslog-ng.conf", "--stderr"]` |

## Configuration

**File:** `watchman/playbooks/gns3_lab.conf:1-19`

```syslog-ng
@version: 4.11

source s_gns3_network {
    udp(ip("0.0.0.0") port(10514) so-rcvbuf(1048576) flags(no-parse));
};

destination d_gns3_nodes {
    file("/var/log/syslog/$HOST/debug.log" create-dirs(yes));
};

destination d_listener {
    program("/usr/local/bin/syslog_listener.sh" template("${HOST} ${MESSAGE}\n"));
};

log {
    source(s_gns3_network);
    destination(d_gns3_nodes);
    destination(d_listener);
};
```

- `:4` — UDP source on all interfaces, port 10514, 1MB receive buffer, no parsing
- `:8` — Archive: writes raw syslog to `/var/log/syslog/<hostname>/debug.log`
- `:12` — Pipeline: pipes each message to `syslog_listener.sh` with template `${HOST} ${MESSAGE}\n`
- `:15-19` — Log block connects source → both destinations

## Listener script

**File:** `watchman/scripts/syslog_listener.sh:1-60`

Reads syslog lines from stdin and forwards critical events to the Watchman API.

| Lines | Purpose |
|---|---|
| 3 | API URL: `$SYSLOG_API_URL` or `http://host.containers.internal:8000/api/syslog/alerts` |
| 5 | Severity name array (0=Emergency through 7=Debug) |
| 10-11 | Extract `source_ip` (first word) and `rest` |
| 15-21 | Extract `msg_hostname` from syslog header via regex |
| 23-29 | Fallback: extract IP from raw message if no hostname |
| 31-35 | **Core parse:** `%([A-Za-z0-9_/-]+)-([0-7])-([A-Za-z0-9_/-]+): (.*)` |
| 37 | **Severity filter:** Only forwards severity ≤ 5 (Emergency through Notification; Debug 6-7 dropped) |
| 43-53 | Build JSON payload: `source_ip`, `facility`, `severity`, `severity_name`, `mnemonic`, `message`, `timestamp` |
| 55-57 | `curl -s -X POST` to Watchman API |

### Regex explanation

For a Cisco syslog message like:
```
<189>576: LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up
```

The regex on line 31 captures:
- Group 1: `LINEPROTO` (facility)
- Group 2: `5` (severity — Notification)
- Group 3: `UPDOWN` (mnemonic)
- Group 4: `Line protocol on Interface...` (message)

## Known issues

| Issue | Detail |
|---|---|
| `oooFROM` typo | `Dockerfile.syslog-ng:1` — `oooFROM` should be `FROM`. Docker may fail to build. |
| Listener not auto-started | The CMD starts syslog-ng but `syslog_listener.sh` is only available as a program destination within the syslog-ng config. It is launched by syslog-ng when messages arrive, not as a standalone process. If syslog-ng doesn't start, the listener won't run. |
| No volume for logs | Archived logs go to `/var/log/syslog/` which is mounted to `playbooks/syslog/` — if the mount fails, logs are lost inside the container. |

## Key files

| File | Lines | Role |
|---|---|---|
| `podman-compose.yaml` | 26-37 | Container definition |
| `watchman/Dockerfile.syslog-ng` | 1-15 | Container build |
| `watchman/playbooks/gns3_lab.conf` | 1-19 | syslog-ng configuration |
| `watchman/scripts/syslog_listener.sh` | 1-60 | Cisco syslog parser + HTTP forwarder |
| `watchman/app/routes/syslog_routes.py` | 63-99 | Alert ingestion endpoint |
| `watchman/app/models/syslog.py` | 1-23 | Alert schemas |

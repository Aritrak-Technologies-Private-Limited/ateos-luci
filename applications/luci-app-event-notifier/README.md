# LuCI Event Notifier

Device-local event and alert configuration for router-side notifications.

This package provides the LuCI configuration UI and default UCI schema. The router-side evaluator, event logger and notification dispatcher should be implemented as a local backend service which reads `/etc/config/event-notifier`.

## Backend requirements

- `curl` and `ca-bundle` for API-based email and SMS delivery.
- `ping` for offline and latency checks.
- `/sys/class/net/*/statistics` or `ubus network.interface status` for speed threshold checks.
- `luci-app-quectel-cm` for SIM status and AT port detection through the `qtcm` rpcd status method.
- `comgt` for the `gcom` command and `/etc/gcom/` scripts used by SIM tampering identity checks. Add `iccid.gcom`, `imsi.gcom` and `imei.gcom` scripts if they are not already present.
- `logread`/syslog parsing for SSH, Telnet and local user login success/failure events.
- `/etc/hotplug.d/` hooks or ubus events for hotplug event capture.
- netifd/ubus events or netlink carrier state for Ethernet plug/unplug capture.
- A local `procd` service or equivalent scheduler to evaluate rules, keep alert state, deduplicate repeated notifications and write local event history.

Email and SMS API credentials follow the same local UCI auth shape used by `luci-app-openwisp`: `url`, `key`, `shared_secret`, `verify_ssl`, `connect_timeout` and `max_time`.

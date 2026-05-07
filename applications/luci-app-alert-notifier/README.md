# LuCI Alert Notifier

Device-local alert configuration for offline, speed threshold, latency and SIM tampering events.

This package provides the LuCI configuration UI and default UCI schema. The router-side evaluator and notification dispatcher should be implemented as a local backend service which reads `/etc/config/alert-notifier`.

## Backend requirements

- `curl` and `ca-bundle` for API-based email and SMS delivery.
- `ping` for offline and latency checks.
- `/sys/class/net/*/statistics` or `ubus network.interface status` for speed threshold checks.
- `luci-app-quectel-cm` for SIM status and AT port detection through the `qtcm` rpcd status method.
- `gcom` scripts from `/usr/share/qtcm-gcom/` for SIM tampering identity checks using ICCID, IMSI and IMEI. Add `iccid.qtcmgcom`, `imsi.qtcmgcom` and `imei.qtcmgcom` scripts if they are not already present.
- A local `procd` service or equivalent scheduler to evaluate rules, keep alert state, deduplicate repeated notifications and write local event history.

Email and SMS API credentials follow the same local UCI auth shape used by `luci-app-openwisp`: `url`, `key`, `shared_secret`, `verify_ssl`, `connect_timeout` and `max_time`.

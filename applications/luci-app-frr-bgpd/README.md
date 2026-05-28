# luci-app-frr-bgpd

LuCI application for configuring FRRouting BGP (`frr` + `frr-bgpd`) on OpenWrt.

The app stores user input in `/etc/config/frr_bgpd`. Pressing **Save & Apply FRR** generates `/etc/frr/frr.conf`, optionally backs up the previous file to `/etc/frr/frr.conf.luci-bak`, enables `zebra`, `bgpd`, `vtysh_enable` and `bfdd` when BFD is used in `/etc/frr/daemons`, then restarts `/etc/init.d/frr`.

## Supported configuration

- FRR daemon basics: enable flag, hostname, log level and router ID
- VRF and kernel routing table targeting
- BGP global settings: local AS, IPv4/IPv6 unicast address families, neighbor-change logging, BGP timers and graceful restart
- BGP origination behavior: default IPv4 neighbor activation and network import-check toggle
- Config safety: generated config preview and backup before overwrite
- Operational checks: status output for FRR, BGP summary, BGP routes, BGP ECMP kernel routes, policy rules and mwan3/pbr presence
- Operational actions: show neighbor, clear BGP, soft reset inbound and soft reset outbound
- ECMP:
  - `maximum-paths`
  - `maximum-paths ibgp`
  - `bgp bestpath as-path multipath-relax`
  - optional router ID comparison in best-path selection
- Route sources:
  - `network` statements
  - aggregate routes with `summary-only` and `as-set`
  - redistribution of connected, static and kernel routes
- Neighbors:
  - peer groups
  - eBGP or iBGP remote AS
  - IPv4, IPv6 or dual-stack activation
  - description, update source, eBGP multihop, password, local AS override and per-neighbor timers
  - BFD
  - next-hop-self, route-reflector client, default-originate, soft-reconfiguration inbound and send-community
  - remove-private-AS, AS override, maximum-prefix and allowas-in
  - common route maps plus IPv4/IPv6-specific route maps
- Policy:
  - IPv4 and IPv6 prefix lists
  - AS-path lists
  - standard, expanded and large community lists
  - route maps with permit/deny sequences
  - prefix-list, AS-path, community and large-community match
  - set local preference, metric, weight, community, large community, route target, AS-path prepend, origin and next hop

## Scope

This app intentionally focuses on BGP. Other FRR routing daemons such as OSPF, IS-IS, RIP, PIM, LDP and Babel are not configured here.

## Tests

Run:

```sh
applications/luci-app-frr-bgpd/tests/run_tests.sh
```

The tests perform shell syntax checks, JavaScript syntax checks when Node.js is available, JSON parsing checks and static coverage checks for the major supported features.

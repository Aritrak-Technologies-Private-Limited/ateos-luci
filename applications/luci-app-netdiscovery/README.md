# LuCI Network Discovery

`luci-app-netdiscovery` is a standalone LuCI application for local OpenWrt network discovery. It aggregates DHCP leases, neighbor table entries, hostapd wireless clients, netifd interface status, and LLDP neighbors into one lightweight dashboard.

The app is generic and local-only. It is not tied to any firmware branding, controller, account, or cloud service.

## Features

- Unified client inventory from DHCP, ARP/neighbor, LuCI host hints, and WiFi station data
- Interface status summary from `network.interface dump`
- Optional LLDP neighbor visibility from `lldpcli`
- Realtime LuCI polling every 7 seconds
- Simple SVG discovery graph with router, interface, WiFi, LAN, and LLDP nodes
- Mobile-responsive table and graph layout

## Data Sources

- `/tmp/dhcp.leases`
- `ip neigh show`
- `ubus call luci-rpc getHostHints`
- `ubus call hostapd.* get_clients`
- `ubus call network.interface dump`
- `lldpcli show neighbors -f json0`

## Install

From an OpenWrt buildroot or feed containing LuCI:

```sh
make package/luci-app-netdiscovery/compile V=s
opkg install /tmp/luci-app-netdiscovery_*.ipk
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

Then open LuCI at **Status > Net Discovery**.

## Package Dependencies

Required:

- `luci-base`
- `rpcd`
- `ucode`
- `ucode-mod-fs`
- `ucode-mod-ubus`
- `ip-full`

Recommended:

- `lldpd` for LLDP neighbor discovery

## JSON Shape

The backend exposes `luci.netdiscovery.get` through rpcd and returns normalized JSON:

```json
{
  "router": {
    "hostname": "OpenWrt",
    "model": "Generic"
  },
  "devices": [],
  "interfaces": [],
  "neighbors": [],
  "updated": 1778150000
}
```

## Future Work

- Bridge forwarding table and switch port correlation
- mDNS discovery
- SNMP polling
- nftables traffic counters
- Historical device persistence
- Alerts and bandwidth graphs

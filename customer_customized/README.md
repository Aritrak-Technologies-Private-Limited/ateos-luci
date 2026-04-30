# Customer Customized LuCI Themes

This folder contains customer-specific notes. Installable LuCI theme packages
should live under the feed's `themes/` directory so OpenWrt package discovery
can find them.

## AnexGate

Package: `themes/luci-theme-anexgate`

The AnexGate theme is based on `luci-theme-material` and is intended to be selected as an optional LuCI theme in OpenWrt build configuration.

To make it visible in OpenWrt `menuconfig`, ensure this repository path is available as a package feed, then select:

```text
LuCI -> Themes -> luci-theme-anexgate
```

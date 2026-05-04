#
# Copyright (C) 2026
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI WireGuard VPN UI
LUCI_DEPENDS:=+luci-base +luci-mod-network +luci-proto-wireguard
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

#
# Copyright (C) 2026
#
# This is free software, licensed under the GNU General Public License v2.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI GRE VPN UI
LUCI_DEPENDS:=+luci-base +luci-mod-network +luci-proto-gre
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Shiva Aradi <developer.aradi@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

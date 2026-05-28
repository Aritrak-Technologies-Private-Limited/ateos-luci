# SPDX-License-Identifier: Apache-2.0

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-frr-bgpd
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Ateos LUCI Maintainers

LUCI_TITLE:=FRR BGP daemon Web UI
LUCI_DESCRIPTION:=Provides a LuCI interface for FRRouting BGP with ECMP, neighbors, route advertisement, prefix lists and route maps.
LUCI_DEPENDS:=+luci-base +frr +frr-bgpd +frr-bfdd

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

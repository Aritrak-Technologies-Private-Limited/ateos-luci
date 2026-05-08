#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the GNU General Public License v2.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=AnexGate Theme
LUCI_DEPENDS:=+luci-base

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Shiva Aradi <developer.aradi@gmail.com>

define Package/luci-theme-anexgate/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.AnexGate
	uci commit luci
}
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

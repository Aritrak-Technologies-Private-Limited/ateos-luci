#
# Copyright (C) 2026 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the GNU General Public License v2.
#

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Shiva Aradi <developer.aradi@gmail.com>

LUCI_TITLE:=LuCI network discovery dashboard
LUCI_DEPENDS:=+luci-base +rpcd +ucode +ucode-mod-fs +ucode-mod-ubus +ip-full +lldpd

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

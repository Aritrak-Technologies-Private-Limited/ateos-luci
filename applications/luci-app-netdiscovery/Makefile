#
# Copyright (C) 2026 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=OpenWrt LuCI community

LUCI_TITLE:=LuCI network discovery dashboard
LUCI_DEPENDS:=+luci-base +rpcd +ucode +ucode-mod-fs +ucode-mod-ubus +ip-full +lldpd

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

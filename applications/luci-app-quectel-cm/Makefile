include $(TOPDIR)/rules.mk

PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Shiva Aradi <developer.aradi@gmail.com>

LUCI_TITLE:=LuCI support for Quectel Connection Manager
LUCI_DESCRIPTION:=LuCI web interface for configuring and monitoring the Quectel Connection Manager.
LUCI_DEPENDS:=+luci-base +luci-mod-network +rpcd-mod-file +qtcm +comgt
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

#
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

PKG_NAME:=internet-healthd
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Shiva Aradi <developer.aradi@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/internet-healthd
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Internet interface health daemon
  DEPENDS:=+jsonfilter
endef

define Package/internet-healthd/description
  Standalone daemon for discovering local interfaces, probing Internet
  reachability per interface and applying configurable recovery actions.
endef

define Build/Compile
endef

define Package/internet-healthd/install
	$(CP) ./root/* $(1)/
endef

$(eval $(call BuildPackage,internet-healthd))

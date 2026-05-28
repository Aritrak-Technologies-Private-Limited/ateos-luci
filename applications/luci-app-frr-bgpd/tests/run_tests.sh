#!/bin/sh

set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
HELPER="$APP_DIR/root/usr/libexec/luci-frr-bgpd"
VIEW="$APP_DIR/htdocs/luci-static/resources/view/frr-bgpd/overview.js"
MENU="$APP_DIR/root/usr/share/luci/menu.d/luci-app-frr-bgpd.json"
ACL="$APP_DIR/root/usr/share/rpcd/acl.d/luci-app-frr-bgpd.json"
README="$APP_DIR/README.md"

assert_contains() {
	file="$1"
	pattern="$2"
	if ! grep -q "$pattern" "$file"; then
		printf "Missing pattern '%s' in %s\n" "$pattern" "$file" >&2
		exit 1
	fi
}

sh -n "$HELPER"

if command -v node >/dev/null 2>&1; then
	node --check "$VIEW"
	node -e "for (const f of process.argv.slice(1)) JSON.parse(require('fs').readFileSync(f, 'utf8'))" "$MENU" "$ACL"
fi

assert_contains "$HELPER" "maximum-paths"
assert_contains "$HELPER" "multipath-relax"
assert_contains "$HELPER" "neighbor .* bfd"
assert_contains "$HELPER" "peer-group"
assert_contains "$HELPER" "route-reflector-client"
assert_contains "$HELPER" "remove-private-AS"
assert_contains "$HELPER" "as-override"
assert_contains "$HELPER" "bgp as-path access-list"
assert_contains "$HELPER" "large-community-list"
assert_contains "$HELPER" "set extcommunity rt"
assert_contains "$HELPER" ".luci-bak"

assert_contains "$VIEW" "Generated config preview"
assert_contains "$VIEW" "Peer Groups"
assert_contains "$VIEW" "BFD"
assert_contains "$VIEW" "VRF"
assert_contains "$VIEW" "AS Path Lists"
assert_contains "$VIEW" "Community Lists"
assert_contains "$VIEW" "Soft reset inbound"
assert_contains "$VIEW" "IPv6 inbound route map"

assert_contains "$README" "BFD"
assert_contains "$README" "VRF"
assert_contains "$README" "config preview"

printf "luci-app-frr-bgpd tests passed\n"

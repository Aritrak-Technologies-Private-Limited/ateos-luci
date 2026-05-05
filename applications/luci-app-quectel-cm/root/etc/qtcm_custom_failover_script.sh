#!/bin/sh

# Called by qtcmsim-failover after a SIM switch.
#
# Arguments:
#   $1 new SIM number
#   $2 old SIM number
#   $3 switch reason
#   $4 active network interface
#   $5 signal dBm
#
# Environment variables are also provided:
#   NEW_SIM
#   OLD_SIM
#   SWITCH_REASON
#   ACTIVE_INTERFACE
#   SIGNAL_DBM

NEW_SIM="${NEW_SIM:-$1}"
OLD_SIM="${OLD_SIM:-$2}"
SWITCH_REASON="${SWITCH_REASON:-$3}"
ACTIVE_INTERFACE="${ACTIVE_INTERFACE:-$4}"
SIGNAL_DBM="${SIGNAL_DBM:-$5}"

logger -t qtcm-custom-failover \
	"SIM switched from ${OLD_SIM:-unknown} to ${NEW_SIM:-unknown}; reason='${SWITCH_REASON:-unknown}', interface='${ACTIVE_INTERFACE:-unknown}', signal='${SIGNAL_DBM:-unknown}'"

case "$OLD_SIM:$NEW_SIM" in
	1:2)
		logger -t qtcm-custom-failover "Direction: SIM1 -> SIM2"

		# Add SIM1 -> SIM2 custom tasks below.
		# Example:
		# /etc/init.d/firewall restart
		;;
	2:1)
		logger -t qtcm-custom-failover "Direction: SIM2 -> SIM1"

		# Add SIM2 -> SIM1 custom tasks below.
		# Example:
		# /etc/init.d/firewall restart
		;;
	*)
		logger -t qtcm-custom-failover "Direction unknown: ${OLD_SIM:-unknown} -> ${NEW_SIM:-unknown}"

		# Add fallback custom tasks below.
		;;
esac

# Common custom tasks for every SIM switch can go below.
# Example:
# /usr/bin/curl -m 5 "https://example.invalid/failover?sim=$NEW_SIM"

exit 0

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

restart_gpio_switch() {
	if [ -x /etc/init.d/gpio_switch ]; then
		/etc/init.d/gpio_switch restart
	else
		logger -t qtcm-custom-failover "gpio_switch init script is not executable"
		return 1
	fi
}

set_switch_value() {
	local name="$1"
	local value="$2"

	uci -q set "system.${name}.value=${value}" || {
		logger -t qtcm-custom-failover "failed to set system.${name}.value=${value}"
		return 1
	}

	uci -q commit system || {
		logger -t qtcm-custom-failover "failed to commit system after setting ${name}"
		return 1
	}

	restart_gpio_switch
}

select_external_sim() {
	case "$1" in
		1)
			logger -t qtcm-custom-failover "Selecting external SIM1 GPIO value 0"
			set_switch_value sim_switch 0
			;;
		2)
			logger -t qtcm-custom-failover "Selecting external SIM2 GPIO value 1"
			set_switch_value sim_switch 1
			;;
		*)
			logger -t qtcm-custom-failover "unknown target SIM '$1'"
			return 1
			;;
	esac
}

power_cycle_mpcie() {
	logger -t qtcm-custom-failover "Power cycling mPCIe modem"
	set_switch_value power_mpcie 0 || return 1
	sleep 3
	set_switch_value power_mpcie 1
}

case "$OLD_SIM:$NEW_SIM" in
	1:2)
		logger -t qtcm-custom-failover "Direction: SIM1 -> SIM2"
		select_external_sim 2 || exit 1
		;;
	2:1)
		logger -t qtcm-custom-failover "Direction: SIM2 -> SIM1"
		select_external_sim 1 || exit 1
		;;
	*)
		logger -t qtcm-custom-failover "Direction unknown: ${OLD_SIM:-unknown} -> ${NEW_SIM:-unknown}"
		select_external_sim "$NEW_SIM" || exit 1
		;;
esac

power_cycle_mpcie || exit 1

exit 0

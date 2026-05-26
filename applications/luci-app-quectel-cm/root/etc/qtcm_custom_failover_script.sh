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

read_uci() {
	uci -q get "$1" 2>/dev/null
}

cfg() {
	local option="$1"
	local fallback="$2"
	local value

	value="$(read_uci "qtcm.sim_switch.$option")"
	[ -n "$value" ] && printf '%s' "$value" || printf '%s' "$fallback"
}

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

sim_value() {
	case "$1" in
		1)
			cfg sim1_value 1
			;;
		2)
			cfg sim2_value 0
			;;
		*)
			logger -t qtcm-custom-failover "unknown target SIM '$1'"
			return 1
			;;
	esac
}

select_gpio_sim() {
	local value

	value="$(sim_value "$1")" || return 1
	logger -t qtcm-custom-failover "Selecting external SIM$1 GPIO value $value"
	set_switch_value sim_switch "$value"
}

detect_at_port() {
	local port

	port="$(read_uci qtcm.main.at_port)"
	[ -n "$port" ] && [ -e "$port" ] && {
		printf '%s' "$port"
		return 0
	}

	for port in /dev/ttyUSB2 /dev/ttyUSB1 /dev/ttyUSB0 /dev/ttyACM0 /dev/stty_nr31; do
		[ -e "$port" ] || continue
		printf '%s' "$port"
		return 0
	done

	return 1
}

send_at_command() {
	local port="$1"
	local command="$2"
	local script status

	[ -n "$port" ] || return 1
	[ -n "$command" ] || return 1

	if command -v microcom >/dev/null 2>&1; then
		printf '%s\r' "$command" | microcom -t 5000 "$port" >/dev/null 2>&1
		return $?
	fi

	if command -v gcom >/dev/null 2>&1; then
		script="/tmp/qtcm-at-$$.gcom"
		cat > "$script" <<EOF
opengt
 set com 115200n81
 set senddelay 0.05
 waitquiet 0.2 0.2
 send "$command^m"
 waitfor 10 "OK","ERROR"
 exit 0
EOF
		gcom -d "$port" -s "$script" >/dev/null 2>&1
		status=$?
		rm -f "$script"
		return "$status"
	fi

	logger -t qtcm-custom-failover "no AT command sender available for module SIM switch"
	return 1
}

select_module_sim() {
	local port command value full_command

	port="$(detect_at_port)" || {
		logger -t qtcm-custom-failover "no AT port detected for module SIM switch"
		return 1
	}

	command="$(cfg command 'AT+QDSIM')"
	value="$(sim_value "$1")" || return 1

	case "$command" in
		*=*)
			full_command="${command}${value}"
			;;
		*)
			full_command="${command}=${value}"
			;;
	esac

	logger -t qtcm-custom-failover "Selecting module SIM$1 with $full_command on $port"
	send_at_command "$port" "$full_command"
}

select_external_sim() {
	local mode

	mode="$(cfg mode gpio)"
	case "$mode" in
		gpio)
			select_gpio_sim "$1"
			;;
		module)
			select_module_sim "$1"
			;;
		none)
			logger -t qtcm-custom-failover "SIM switch mode is none; hardware switch skipped"
			;;
		*)
			logger -t qtcm-custom-failover "unknown SIM switch mode '$mode'"
			return 1
			;;
	esac
}

power_cycle_mpcie() {
	[ "$(cfg power_cycle_mpcie 1)" = "1" ] || {
		logger -t qtcm-custom-failover "mPCIe power cycle disabled"
		return 0
	}

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

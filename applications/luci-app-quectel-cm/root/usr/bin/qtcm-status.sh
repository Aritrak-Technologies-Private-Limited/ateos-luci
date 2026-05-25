#!/bin/sh

LOG_FALLBACK="/tmp/q-cm.log"
GCOM_DIR="/usr/share/qtcm-gcom"

json_escape() {
	local value="$1"

	value=$(printf '%s' "$value" | sed \
		-e 's/\\/\\\\/g' \
		-e 's/"/\\"/g' \
		-e 's/\t/\\t/g' \
		-e 's/\r/\\r/g' \
		-e 's/\n/\\n/g')

	printf '%s' "$value"
}

json_bool() {
	[ "$1" = "1" ] && printf 'true' || printf 'false'
}

read_uci() {
	uci -q get "$1" 2>/dev/null
}

trim_line() {
	printf '%s' "$1" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

read_sim_option() {
	local sim="$1"
	local option="$2"
	local value

	value="$(read_uci "qtcm.sim${sim}.${option}")"
	[ -n "$value" ] || value="$(read_uci "qtcm.sim${sim}_${option}")"
	printf '%s' "$value"
}

sim_enabled_text() {
	[ "$(read_sim_option "$1" enabled)" = "1" ] && printf '%s' "Enabled" || printf '%s' "Disabled"
}

sim_summary() {
	local sim="$1"
	local desc apn ip_type network_mode

	desc="$(read_sim_option "$sim" description)"
	apn="$(read_sim_option "$sim" apn)"
	ip_type="$(read_sim_option "$sim" ip_type)"
	network_mode="$(read_sim_option "$sim" network_mode)"

	[ -n "$desc" ] || desc="SIM $sim"
	[ -n "$apn" ] || apn="APN not set"
	[ -n "$ip_type" ] || ip_type="ipv4"
	[ -n "$network_mode" ] || network_mode="auto"

	printf '%s - %s, %s, %s, %s' "$desc" "$(sim_enabled_text "$sim")" "$apn" "$network_mode" "$ip_type"
}

detect_service_running() {
	if command -v ubus >/dev/null 2>&1; then
		ubus call service list '{"name":"qtcm"}' 2>/dev/null | grep -q '"running":true' && return 0
	fi

	if command -v pgrep >/dev/null 2>&1; then
		pgrep -f '(^|[[:space:]])/sbin/quectel-CM([[:space:]]|$)' >/dev/null 2>&1 && return 0
	fi

	pidof quectel-CM >/dev/null 2>&1
}

detect_interface() {
	local configured iface log_file

	configured="$(read_uci qtcm.main.network_interface)"
	if [ -n "$configured" ]; then
		printf '%s' "$configured"
		return 0
	fi

	log_file="$(read_uci qtcm.main.log_file)"
	[ -n "$log_file" ] || log_file="$LOG_FALLBACK"

	if [ -f "$log_file" ]; then
		iface="$(sed -n 's/.*Auto find usbnet_adapter = \(.*\)$/\1/p' "$log_file" | tail -n 1)"
		if [ -n "$iface" ]; then
			printf '%s' "$iface"
			return 0
		fi
	fi

	if command -v ip >/dev/null 2>&1; then
		iface="$(ip -o link show 2>/dev/null | awk -F': ' '/: (wwan[0-9_]*|usb[0-9.]*|rmnet[[:alnum:]._-]*|qmimux[0-9]+)/ { print $2; exit }')"
		if [ -n "$iface" ]; then
			printf '%s' "$iface"
			return 0
		fi
	fi

	printf '%s' "Unknown"
}

detect_at_port() {
	local candidate

	for candidate in \
		"$(read_uci qtcm.main.at_port)" \
		"/dev/ttyUSB2" \
		"/dev/ttyUSB1" \
		"/dev/ttyUSB0" \
		"/dev/ttyACM0" \
		"/dev/stty_nr31"
	do
		[ -n "$candidate" ] || continue
		[ -e "$candidate" ] || continue
		printf '%s' "$candidate"
		return 0
	done

	printf '%s' ""
}

run_gcom_script() {
	local port="$1"
	local script="$2"

	[ -n "$port" ] || return 1
	[ -x /usr/bin/gcom ] || [ -x /bin/gcom ] || return 1
	[ -f "$GCOM_DIR/$script" ] || return 1

	gcom -d "$port" -s "$GCOM_DIR/$script" 2>/dev/null
}

parse_sim_status() {
	local raw line

	raw="$1"
	line="$(trim_line "$(printf '%s\n' "$raw" | tail -n 1)")"

	case "$line" in
		*"SIM ready"*|*"READY"*)
			printf '%s' "Yes"
			;;
		*"SIM PIN"*|*"SIM PUK"*)
			printf '%s' "Yes (locked)"
			;;
		*"SIM ERROR"*|*"Check SIM is inserted"*)
			printf '%s' "No"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

parse_reg_status() {
	local raw stat

	raw="$(trim_line "$1")"
	stat="$(printf '%s' "$raw" | awk -F',' 'NF >= 2 { gsub(/[^0-9]/, "", $2); print $2; exit }')"

	case "$stat" in
		1|5)
			printf '%s' "Yes"
			;;
		0|2|3|4)
			printf '%s' "No"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

parse_provider() {
	local raw provider

	raw="$(trim_line "$1")"
	provider="$(printf '%s' "$raw" | sed -n 's/.*,"\([^"]*\)".*/\1/p' | head -n 1)"
	[ -n "$provider" ] || provider="$(printf '%s' "$raw" | awk -F',' 'NF { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0); print $0 }' | head -n 1)"
	[ -n "$provider" ] || provider="Unknown"
	printf '%s' "$provider"
}

parse_network_type() {
	local raw lower

	raw="$1"
	lower="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"

	case "$lower" in
		*nr5g*|*5g*)
			printf '%s' "5G"
			;;
		*lte*|*e-utran*|*4g*)
			printf '%s' "4G"
			;;
		*wcdma*|*utran*|*3g*)
			printf '%s' "3G"
			;;
		*gsm*|*gprs*|*edge*|*2g*)
			printf '%s' "2G"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

parse_signal_text() {
	local raw lower value

	raw="$1"
	lower="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"

	if printf '%s' "$lower" | grep -q 'rsrp'; then
		value="$(printf '%s' "$raw" | sed -n 's/.*\(RSRP[^-0-9]*-[0-9][0-9]*\).*/\1/p' | head -n 1)"
		[ -n "$value" ] && { printf '%s' "$value"; return; }
	fi

	value="$(printf '%s' "$raw" | awk -F',' 'NF >= 1 { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $1); print $0 }' | head -n 1)"
	[ -n "$value" ] || value="$(trim_line "$raw")"
	[ -n "$value" ] || value="Unknown"
	printf '%s' "$value"
}

parse_signal_snr() {
	local raw value

	raw="$1"
	value="$(printf '%s' "$raw" | sed -n 's/.*SNR[^-0-9]*\(-\{0,1\}[0-9][0-9]*\).*/\1/p' | head -n 1)"
	[ -n "$value" ] || value="$(printf '%s' "$raw" | sed -n 's/.*SINR[^-0-9]*\(-\{0,1\}[0-9][0-9]*\).*/\1/p' | head -n 1)"
	[ -n "$value" ] || value="Unknown"
	printf '%s' "$value"
}

signal_bars_from_csq() {
	local raw rssi

	raw="$(trim_line "$1")"
	rssi="$(printf '%s' "$raw" | awk -F',' '{ gsub(/[^0-9]/, "", $1); print $1; exit }')"

	case "$rssi" in
		''|99)
			printf '%s' "Unknown"
			;;
		0|1|2|3|4|5|6|7|8|9)
			printf '%s' "1/5"
			;;
		10|11|12|13|14|15)
			printf '%s' "2/5"
			;;
		16|17|18|19|20)
			printf '%s' "3/5"
			;;
		21|22|23|24|25)
			printf '%s' "4/5"
			;;
		26|27|28|29|30|31)
			printf '%s' "5/5"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

signal_dbm_from_csq() {
	local raw rssi

	raw="$(trim_line "$1")"
	rssi="$(printf '%s' "$raw" | awk -F',' '{ gsub(/[^0-9]/, "", $1); print $1; exit }')"

	case "$rssi" in
		''|99)
			printf '%s' "Unknown"
			;;
		*)
			awk -v rssi="$rssi" 'BEGIN { printf "%d", -113 + (2 * rssi) }'
			;;
	esac
}

main() {
	local running=0
	local interface at_port
	local modem_source sim_status network_status network_type provider signal_bars signal_text signal_dbm signal_snr
	local sim_raw reg_raw provider_raw serving_raw csq_raw
	local active_sim sim1_info sim2_info

	if detect_service_running; then
		running=1
	fi

	interface="$(detect_interface)"
	at_port="$(detect_at_port)"
	active_sim="$(read_uci qtcm.main.active_sim)"
	[ "$active_sim" = "2" ] || active_sim="1"
	sim1_info="$(sim_summary 1)"
	sim2_info="$(sim_summary 2)"

	if [ -n "$at_port" ]; then
		sim_raw="$(run_gcom_script "$at_port" "sim_status.qtcmgcom")"
		reg_raw="$(run_gcom_script "$at_port" "simreg_status.qtcmgcom")"
		provider_raw="$(run_gcom_script "$at_port" "carrier.qtcmgcom")"
		serving_raw="$(run_gcom_script "$at_port" "servingcell.qtcmgcom")"
		csq_raw="$(run_gcom_script "$at_port" "csq.qtcmgcom")"

		modem_source="gcom via $at_port"
		sim_status="$(parse_sim_status "$sim_raw")"
		network_status="$(parse_reg_status "$reg_raw")"
		network_type="$(parse_network_type "$serving_raw $provider_raw")"
		provider="$(parse_provider "$provider_raw")"
		signal_bars="$(signal_bars_from_csq "$csq_raw")"
		signal_dbm="$(signal_dbm_from_csq "$csq_raw")"
		signal_snr="$(parse_signal_snr "$serving_raw")"
		signal_text="$(trim_line "$csq_raw")"
		[ -n "$signal_text" ] || signal_text="$(parse_signal_text "$serving_raw")"
	else
		modem_source="No modem AT port detected"
		sim_status="Unknown"
		network_status="Unknown"
		network_type="Unknown"
		provider="Unknown"
		signal_bars="Unknown"
		signal_dbm="Unknown"
		signal_snr="Unknown"
		signal_text="Unknown"
	fi

	printf '{'
	printf '"service_running":%s,' "$(json_bool "$running")"
	printf '"at_port":"%s",' "$(json_escape "$at_port")"
	printf '"interface":"%s",' "$(json_escape "$interface")"
	printf '"sim_status":"%s",' "$(json_escape "$sim_status")"
	printf '"network_status":"%s",' "$(json_escape "$network_status")"
	printf '"network_type":"%s",' "$(json_escape "$network_type")"
	printf '"provider":"%s",' "$(json_escape "$provider")"
	printf '"signal_bars":"%s",' "$(json_escape "$signal_bars")"
	printf '"signal_dbm":"%s",' "$(json_escape "$signal_dbm")"
	printf '"signal_snr":"%s",' "$(json_escape "$signal_snr")"
	printf '"signal_text":"%s",' "$(json_escape "$signal_text")"
	printf '"modem_source":"%s",' "$(json_escape "$modem_source")"
	printf '"active_sim":"%s",' "$(json_escape "$active_sim")"
	printf '"sim1_info":"%s",' "$(json_escape "$sim1_info")"
	printf '"sim2_info":"%s"' "$(json_escape "$sim2_info")"
	printf '}\n'
}

main "$@"

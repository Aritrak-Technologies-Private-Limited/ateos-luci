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

active_sim_from_gpio() {
	local mode value sim1_value sim2_value

	mode="$(read_uci qtcm.sim_switch.mode)"
	[ -n "$mode" ] || mode="gpio"
	[ "$mode" = "gpio" ] || return 0

	sim1_value="$(read_uci qtcm.sim_switch.sim1_value)"
	[ -n "$sim1_value" ] || sim1_value="1"
	sim2_value="$(read_uci qtcm.sim_switch.sim2_value)"
	[ -n "$sim2_value" ] || sim2_value="0"
	value="$(read_uci system.sim_switch.value)"

	[ "$value" = "$sim1_value" ] && {
		printf '%s' "1"
		return
	}

	[ "$value" = "$sim2_value" ] && {
		printf '%s' "2"
		return
	}

	printf '%s' ""
}

active_sim_source() {
	local mode

	mode="$(read_uci qtcm.sim_switch.mode)"
	[ -n "$mode" ] || mode="gpio"

	case "$mode" in
		gpio)
			[ -n "$(active_sim_from_gpio)" ] && printf '%s' "GPIO" || printf '%s' "UCI"
			;;
		module)
			printf '%s' "Module/UCI"
			;;
		none)
			printf '%s' "UCI"
			;;
		*)
			printf '%s' "UCI"
			;;
	esac
}

sync_sim_leds() {
	local sim="$1"
	local sim1="/sys/class/leds/led:sim1/brightness"
	local sim2="/sys/class/leds/led:sim2/brightness"

	case "$sim" in
		1)
			[ -w "$sim1" ] && echo 1 > "$sim1"
			[ -w "$sim2" ] && echo 0 > "$sim2"
			;;
		2)
			[ -w "$sim1" ] && echo 0 > "$sim1"
			[ -w "$sim2" ] && echo 1 > "$sim2"
			;;
	esac
}

set_led_trigger() {
	local led="$1"
	local trigger="$2"

	[ -w "$led/trigger" ] || return 1
	echo "$trigger" > "$led/trigger" 2>/dev/null
}

set_led_brightness() {
	local led="$1"
	local value="$2"

	[ -w "$led/brightness" ] || return 1
	echo "$value" > "$led/brightness" 2>/dev/null
}

sync_gsm_led() {
	local status="$1"
	local led="/sys/class/leds/led:gsm"

	[ -d "$led" ] || return 0

	case "$status" in
		Yes)
			set_led_trigger "$led" none
			set_led_brightness "$led" 1
			;;
		*)
			if set_led_trigger "$led" timer; then
				[ -w "$led/delay_on" ] && echo 500 > "$led/delay_on" 2>/dev/null
				[ -w "$led/delay_off" ] && echo 500 > "$led/delay_off" 2>/dev/null
			else
				set_led_brightness "$led" 1
			fi
			;;
	esac
}

detect_service_running() {
	if command -v ubus >/dev/null 2>&1; then
		ubus call service list '{"name":"qtcm"}' 2>/dev/null | grep -q '"running":true' && return 0
	fi

	if command -v pgrep >/dev/null 2>&1; then
		pgrep -f '(^|[[:space:]])/sbin/quectel-CM([[:space:]]|$)' >/dev/null 2>&1 && return 0
	fi

	pidof quectel-CM >/dev/null 2>&1 && return 0

	ps 2>/dev/null | grep -F '/sbin/quectel-CM' | grep -v grep >/dev/null 2>&1
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
		*"SIM ERROR"*|*"SIM not inserted"*|*"Check SIM is inserted"*)
			printf '%s' "No"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

parse_reg_status() {
	local raw stat saw_not_registered=0

	raw="$1"
	for stat in $(printf '%s\n' "$raw" | awk -F',' '/\+C(E|G)?REG:/ && NF >= 2 { gsub(/[^0-9]/, "", $2); print $2 }'); do
		case "$stat" in
			1|5)
				printf '%s' "Yes"
				return
				;;
			0|2|3|4)
				saw_not_registered=1
				;;
		esac
	done

	[ "$saw_not_registered" = "1" ] && printf '%s' "No" || printf '%s' "Unknown"
}

parse_provider() {
	local raw provider

	raw="$(trim_line "$1")"
	provider="$(printf '%s\n' "$raw" | awk -F',' '/\+QSPN:/ {
		for (i = 1; i <= 3 && i <= NF; i++) {
			value = $i;
			sub(/^.*\+QSPN:[[:space:]]*/, "", value);
			gsub(/^[[:space:]]+|[[:space:]]+$/, "", value);
			gsub(/^"|"$/, "", value);
			if (value != "") {
				print value;
				exit;
			}
		}
	}')"
	[ -n "$provider" ] || provider="$(printf '%s\n' "$raw" | awk -F',' '/\+COPS:/ && NF >= 3 {
		value = $3;
		gsub(/^[[:space:]]+|[[:space:]]+$/, "", value);
		gsub(/^"|"$/, "", value);
		print value;
		exit;
	}')"
	[ -n "$provider" ] || provider="Unknown"
	printf '%s' "$provider"
}

network_type_from_cops() {
	local raw act

	raw="$1"
	act="$(printf '%s\n' "$raw" | awk -F',' '/\+COPS:/ {
		gsub(/[^0-9]/, "", $4);
		if ($4 != "") {
			print $4;
			exit;
		}
	}')"

	case "$act" in
		7)
			printf '%s' "4G"
			;;
		0|1|3)
			printf '%s' "2G"
			;;
		2|4|5|6)
			printf '%s' "3G"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

parse_network_type() {
	local raw lower value

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
			value="$(network_type_from_cops "$raw")"
			printf '%s' "$value"
			;;
	esac
}

parse_band_info() {
	local raw value

	raw="$1"
	value="$(printf '%s\n' "$raw" | awk -F',' '/\+QENG:/ {
		for (i = 1; i <= NF; i++) {
			field = $i;
			gsub(/^[[:space:]]+|[[:space:]]+$/, "", field);
			gsub(/"/, "", field);
			if (field == "LTE" && NF >= 10) {
				pci = $8;
				earfcn = $9;
				band = $10;
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", pci);
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", earfcn);
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", band);
				printf "Band %s, EARFCN %s, PCI %s", band, earfcn, pci;
				exit;
			}
		}
	}' | head -n 1)"
	[ -n "$value" ] || value="Unknown"
	printf '%s' "$value"
}

parse_imei() {
	local raw value

	raw="$1"
	value="$(printf '%s\n' "$raw" | awk '/\+CGSN:|\+IMEI:/ {
		value = $0;
		gsub(/[^0-9]/, "", value);
		if (length(value) >= 14 && length(value) <= 17) {
			print value;
			exit;
		}
	}')"
	[ -n "$value" ] || value="Unknown"
	printf '%s' "$value"
}

parse_iccid() {
	local raw value

	raw="$1"
	value="$(printf '%s\n' "$raw" | awk '/\+QCCID:/ {
		value = $0;
		gsub(/[^0-9]/, "", value);
		if (length(value) >= 15 && length(value) <= 22) {
			print value;
			exit;
		}
	}')"
	[ -n "$value" ] || value="Unknown"
	printf '%s' "$value"
}

parse_imsi() {
	local raw value

	raw="$1"
	value="$(printf '%s\n' "$raw" | awk '/\+IMSI:/ {
		value = $0;
		gsub(/[^0-9]/, "", value);
		if (length(value) >= 5 && length(value) <= 18) {
			print value;
			exit;
		}
	}')"
	[ -n "$value" ] || value="Unknown"
	printf '%s' "$value"
}

parse_sim_slot() {
	local raw value

	raw="$1"
	value="$(printf '%s\n' "$raw" | awk -F':' '/\+QDSIM:/ && $2 !~ /\(/ {
		value = $2;
		gsub(/[^0-9]/, "", value);
		if (value != "") {
			print value;
			exit;
		}
	}')"

	case "$value" in
		0)
			printf '%s' "SIM 1"
			;;
		1)
			printf '%s' "SIM 2"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

parse_sim_slots_supported() {
	local raw value

	raw="$1"
	value="$(printf '%s\n' "$raw" | awk -F':' '/\+QDSIM:/ && $2 ~ /\(/ {
		value = $2;
		gsub(/[^0-9,]/, "", value);
		split(value, ids, ",");
		for (i in ids) {
			if (ids[i] != "")
				seen[ids[i]] = 1;
		}
		for (i in seen)
			count++;
		if (count > 0) {
			print count;
			exit;
		}
	}')"
	[ -n "$value" ] || value="Unknown"
	printf '%s' "$value"
}

parse_dsss_status() {
	local raw value

	raw="$1"
	value="$(printf '%s\n' "$raw" | awk -F',' '/\+QDSIMCFG:/ {
		value = $2;
		gsub(/[^0-9]/, "", value);
		if (value != "") {
			print value;
			exit;
		}
	}')"

	case "$value" in
		1)
			printf '%s' "Enabled"
			;;
		0)
			printf '%s' "Disabled"
			;;
		*)
			printf '%s' "Unknown"
			;;
	esac
}

connected_sim_count() {
	case "$1" in
		Yes|Yes\ \(*)
			printf '%s' "1"
			;;
		No)
			printf '%s' "0"
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

	value="$(printf '%s\n' "$raw" | awk -F',' '/\+QENG:/ {
		for (i = 1; i <= NF; i++) {
			field = $i;
			gsub(/^[[:space:]]+|[[:space:]]+$/, "", field);
			gsub(/"/, "", field);
			if (field == "LTE" && NF >= 17) {
				rsrp = $14;
				rsrq = $15;
				rssi = $16;
				sinr = $17;
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", rsrp);
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", rsrq);
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", rssi);
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", sinr);
				printf "RSRP %s dBm, RSRQ %s dB, RSSI %s dBm, SINR %s dB", rsrp, rsrq, rssi, sinr;
				exit;
			}
		}
	}' | head -n 1)"
	[ -n "$value" ] && { printf '%s' "$value"; return; }

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
	[ -n "$value" ] || value="$(printf '%s\n' "$raw" | awk -F',' '/\+QENG:/ {
		for (i = 1; i <= NF; i++) {
			field = $i;
			gsub(/^[[:space:]]+|[[:space:]]+$/, "", field);
			gsub(/"/, "", field);
			if (field == "LTE" && NF >= 17) {
				value = $17;
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", value);
				print value;
				exit;
			}
		}
	}' | head -n 1)"
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
	local modem_source sim_status network_status network_type band_info provider signal_bars signal_text signal_dbm signal_snr
	local imei iccid imsi active_sim_slot sim_slots_supported dsss_status connected_sims
	local sim_raw reg_raw provider_raw serving_raw csq_raw identity_raw sim_slot_raw
	local active_sim active_sim_gpio active_sim_src sim1_info sim2_info

	if detect_service_running; then
		running=1
	fi

	interface="$(detect_interface)"
	at_port="$(detect_at_port)"
	active_sim_gpio="$(active_sim_from_gpio)"
	active_sim="$(read_uci qtcm.main.active_sim)"
	[ "$active_sim" = "2" ] || active_sim="1"
	[ -n "$active_sim_gpio" ] && active_sim="$active_sim_gpio"
	active_sim_src="$(active_sim_source)"
	sync_sim_leds "$active_sim"
	sim1_info="$(sim_summary 1)"
	sim2_info="$(sim_summary 2)"

	if [ -n "$at_port" ]; then
		sim_raw="$(run_gcom_script "$at_port" "sim_status.qtcmgcom")"
		reg_raw="$(run_gcom_script "$at_port" "simreg_status.qtcmgcom")"
		provider_raw="$(run_gcom_script "$at_port" "carrier.qtcmgcom")"
		serving_raw="$(run_gcom_script "$at_port" "servingcell.qtcmgcom")"
		csq_raw="$(run_gcom_script "$at_port" "csq.qtcmgcom")"
		identity_raw="$(run_gcom_script "$at_port" "identity.qtcmgcom")"
		sim_slot_raw="$(run_gcom_script "$at_port" "sim_slot.qtcmgcom")"

		modem_source="gcom via $at_port"
		sim_status="$(parse_sim_status "$sim_raw")"
		network_status="$(parse_reg_status "$reg_raw")"
		sync_gsm_led "$network_status"
		network_type="$(parse_network_type "$serving_raw $provider_raw")"
		band_info="$(parse_band_info "$serving_raw")"
		imei="$(parse_imei "$identity_raw")"
		iccid="$(parse_iccid "$identity_raw")"
		imsi="$(parse_imsi "$identity_raw")"
		active_sim_slot="$(parse_sim_slot "$sim_slot_raw")"
		sim_slots_supported="$(parse_sim_slots_supported "$sim_slot_raw")"
		dsss_status="$(parse_dsss_status "$sim_slot_raw")"
		connected_sims="$(connected_sim_count "$sim_status")"
		provider="$(parse_provider "$provider_raw")"
		signal_bars="$(signal_bars_from_csq "$csq_raw")"
		signal_dbm="$(signal_dbm_from_csq "$csq_raw")"
		signal_snr="$(parse_signal_snr "$serving_raw")"
		signal_text="$(parse_signal_text "$serving_raw")"
		[ "$signal_text" != "Unknown" ] || signal_text="$(trim_line "$csq_raw")"
		[ -n "$signal_text" ] || signal_text="Unknown"
	else
		modem_source="No modem AT port detected"
		sim_status="Unknown"
		network_status="Unknown"
		sync_gsm_led "$network_status"
		network_type="Unknown"
		band_info="Unknown"
		imei="Unknown"
		iccid="Unknown"
		imsi="Unknown"
		active_sim_slot="Unknown"
		sim_slots_supported="Unknown"
		dsss_status="Unknown"
		connected_sims="Unknown"
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
	printf '"band_info":"%s",' "$(json_escape "$band_info")"
	printf '"imei":"%s",' "$(json_escape "$imei")"
	printf '"iccid":"%s",' "$(json_escape "$iccid")"
	printf '"imsi":"%s",' "$(json_escape "$imsi")"
	printf '"active_sim_slot":"%s",' "$(json_escape "$active_sim_slot")"
	printf '"sim_slots_supported":"%s",' "$(json_escape "$sim_slots_supported")"
	printf '"dsss_status":"%s",' "$(json_escape "$dsss_status")"
	printf '"connected_sims":"%s",' "$(json_escape "$connected_sims")"
	printf '"provider":"%s",' "$(json_escape "$provider")"
	printf '"signal_bars":"%s",' "$(json_escape "$signal_bars")"
	printf '"signal_dbm":"%s",' "$(json_escape "$signal_dbm")"
	printf '"signal_snr":"%s",' "$(json_escape "$signal_snr")"
	printf '"signal_text":"%s",' "$(json_escape "$signal_text")"
	printf '"modem_source":"%s",' "$(json_escape "$modem_source")"
	printf '"active_sim":"%s",' "$(json_escape "$active_sim")"
	printf '"active_sim_source":"%s",' "$(json_escape "$active_sim_src")"
	printf '"sim1_info":"%s",' "$(json_escape "$sim1_info")"
	printf '"sim2_info":"%s"' "$(json_escape "$sim2_info")"
	printf '}\n'
}

main "$@"

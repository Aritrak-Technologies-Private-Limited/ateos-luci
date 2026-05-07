#!/bin/sh

CONFIG="event-notifier"
DEFAULT_SPOOL_DIR="/var/run/event-notifier"
DEFAULT_EVENT_LOG="/var/log/event-notifier.log"

uci_get() {
	uci -q get "$CONFIG.$1.$2" 2>/dev/null
}

uci_get_bool() {
	local value

	value="$(uci_get "$1" "$2")"
	[ "$value" = "1" ] || [ "$value" = "true" ] || [ "$value" = "yes" ]
}

uci_get_list() {
	uci -q get "$CONFIG.$1.$2" 2>/dev/null
}

service_enabled() {
	uci_get_bool main enabled
}

event_log_file() {
	local file

	file="$(uci_get main event_log)"
	[ -n "$file" ] || file="$DEFAULT_EVENT_LOG"
	printf '%s' "$file"
}

spool_dir() {
	local dir

	dir="$(uci_get main spool_dir)"
	[ -n "$dir" ] || dir="$DEFAULT_SPOOL_DIR"
	printf '%s' "$dir"
}

dedupe_window() {
	local seconds

	seconds="$(uci_get main dedupe_window)"
	[ -n "$seconds" ] || seconds="300"
	printf '%s' "$seconds"
}

ensure_runtime() {
	local dir log

	dir="$(spool_dir)"
	log="$(event_log_file)"
	mkdir -p "$dir" "$(dirname "$log")"
}

json_escape() {
	local value="$1"

	value="$(printf '%s' "$value" | sed \
		-e 's/\\/\\\\/g' \
		-e 's/"/\\"/g' \
		-e 's/\t/\\t/g' \
		-e 's/\r/\\r/g' \
		-e 's/\n/\\n/g')"

	printf '%s' "$value"
}

event_enabled() {
	uci_get_bool "$1" enabled
}

event_has_value() {
	local section="$1"
	local option="$2"
	local needle="$3"
	local value

	for value in $(uci_get_list "$section" "$option"); do
		[ "$value" = "$needle" ] && return 0
		[ "$value" = "*" ] && return 0
	done

	return 1
}

event_channels() {
	local section="$1"
	local channels

	channels="$(uci_get_list "$section" channel)"
	[ -n "$channels" ] || channels="email"
	printf '%s' "$channels"
}

should_emit() {
	local key="$1"
	local now last_file last window

	ensure_runtime
	now="$(date +%s)"
	last_file="$(spool_dir)/dedupe.$(printf '%s' "$key" | tr -c 'A-Za-z0-9_.-' '_')"
	window="$(dedupe_window)"

	if [ -f "$last_file" ]; then
		last="$(cat "$last_file" 2>/dev/null)"
		if [ -n "$last" ] && [ $((now - last)) -lt "$window" ]; then
			return 1
		fi
	fi

	printf '%s' "$now" > "$last_file"
	return 0
}

append_event_log() {
	local section="$1"
	local type="$2"
	local severity="$3"
	local source="$4"
	local subject="$5"
	local message="$6"
	local log

	ensure_runtime
	log="$(event_log_file)"

	printf '%s section=%s type=%s severity=%s source=%s subject="%s" message="%s"\n' \
		"$(date '+%Y-%m-%d %H:%M:%S')" \
		"$section" "$type" "$severity" "$source" "$subject" "$message" >> "$log"
}

api_post() {
	local channel="$1"
	local subject="$2"
	local message="$3"
	local type="$4"
	local severity="$5"
	local url key secret verify_ssl connect_timeout max_time recipient recipients sender from payload insecure

	[ "$(uci_get "$channel" enabled)" = "1" ] || return 0

	url="$(uci_get "$channel" url)"
	[ -n "$url" ] || return 0

	key="$(uci_get "$channel" key)"
	secret="$(uci_get "$channel" shared_secret)"
	verify_ssl="$(uci_get "$channel" verify_ssl)"
	connect_timeout="$(uci_get "$channel" connect_timeout)"
	max_time="$(uci_get "$channel" max_time)"
	recipients="$(uci_get_list "$channel" recipient)"
	from="$(uci_get "$channel" from)"
	sender="$(uci_get "$channel" sender)"
	[ -n "$connect_timeout" ] || connect_timeout="15"
	[ -n "$max_time" ] || max_time="30"
	[ "$verify_ssl" = "0" ] && insecure="-k" || insecure=""

	if [ -z "$recipients" ]; then
		payload='{"type":"'"$(json_escape "$type")"'","severity":"'"$(json_escape "$severity")"'","subject":"'"$(json_escape "$subject")"'","message":"'"$(json_escape "$message")"'","from":"'"$(json_escape "$from")"'","sender":"'"$(json_escape "$sender")"'"}'
		curl -sS $insecure --connect-timeout "$connect_timeout" --max-time "$max_time" \
			-H "Content-Type: application/json" \
			-H "X-API-Key: $key" \
			-H "X-Shared-Secret: $secret" \
			-d "$payload" "$url" >/dev/null 2>&1
		return 0
	fi

	for recipient in $recipients; do
		payload='{"type":"'"$(json_escape "$type")"'","severity":"'"$(json_escape "$severity")"'","subject":"'"$(json_escape "$subject")"'","message":"'"$(json_escape "$message")"'","recipient":"'"$(json_escape "$recipient")"'","from":"'"$(json_escape "$from")"'","sender":"'"$(json_escape "$sender")"'"}'
		curl -sS $insecure --connect-timeout "$connect_timeout" --max-time "$max_time" \
			-H "Content-Type: application/json" \
			-H "X-API-Key: $key" \
			-H "X-Shared-Secret: $secret" \
			-d "$payload" "$url" >/dev/null 2>&1
	done
}

emit_event() {
	local section="$1"
	local type="$2"
	local severity="$3"
	local source="$4"
	local subject="$5"
	local message="$6"
	local key="$7"
	local channel

	[ -n "$severity" ] || severity="$(uci_get "$section" severity)"
	[ -n "$severity" ] || severity="info"
	[ -n "$key" ] || key="$section:$type:$subject:$message"

	should_emit "$key" || return 0
	append_event_log "$section" "$type" "$severity" "$source" "$subject" "$message"

	for channel in $(event_channels "$section"); do
		case "$channel" in
			email) api_post email "$subject" "$message" "$type" "$severity" ;;
			sms) api_post sms "$subject" "$message" "$type" "$severity" ;;
		esac
	done
}

resolve_interface_device() {
	local iface="$1"
	local status device

	[ "$iface" = "*" ] && { printf '%s' "*"; return 0; }
	[ -d "/sys/class/net/$iface" ] && { printf '%s' "$iface"; return 0; }

	if command -v ubus >/dev/null 2>&1; then
		status="$(ubus call "network.interface.$iface" status 2>/dev/null)"
		device="$(printf '%s' "$status" | sed -n 's/.*"l3_device"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
		[ -n "$device" ] || device="$(printf '%s' "$status" | sed -n 's/.*"device"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
		if [ -n "$device" ]; then
			printf '%s' "$device"
			return 0
		fi
	fi

	printf '%s' "$iface"
}

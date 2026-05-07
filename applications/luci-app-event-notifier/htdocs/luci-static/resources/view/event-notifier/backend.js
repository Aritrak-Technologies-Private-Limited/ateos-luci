'use strict';
'require view';

return view.extend({
	render: function() {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Event Notifier Backend Needs')),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('This LuCI app stores device-local alert rules, event rules and notification settings. The router backend must evaluate these rules locally and send notifications directly from the device.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Router packages')),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Need')),
						E('th', { 'class': 'th' }, _('Package or source'))
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('HTTP API delivery')),
						E('td', { 'class': 'td' }, 'curl, ca-bundle')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Offline and latency checks')),
						E('td', { 'class': 'td' }, 'iputils-ping or busybox ping')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Speed threshold checks')),
						E('td', { 'class': 'td' }, '/sys/class/net/*/statistics or ubus network.interface status')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('SIM tampering checks')),
						E('td', { 'class': 'td' }, 'luci-app-quectel-cm, qtcm rpcd status, comgt/gcom, /etc/gcom/*.gcom')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Local scheduling')),
						E('td', { 'class': 'td' }, 'procd init script or cron')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Login event parsing')),
						E('td', { 'class': 'td' }, 'logread, syslog auth/dropbear/telnet messages')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Hotplug events')),
						E('td', { 'class': 'td' }, '/etc/hotplug.d/ hooks or ubus events')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Ethernet link events')),
						E('td', { 'class': 'td' }, 'netifd/ubus events or netlink carrier state')
					])
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Backend service contract')),
				E('ul', {}, [
					E('li', {}, _('Read UCI config from event-notifier.')),
					E('li', {}, _('Maintain local alert state for firing, recovery, and repeat suppression.')),
					E('li', {}, _('Parse local system logs for login success/failure events, with selectable SSH, Telnet and local user login methods.')),
					E('li', {}, _('Capture hotplug and Ethernet plug/unplug events locally.')),
					E('li', {}, _('Use luci-app-quectel-cm/qtcm status to identify the active modem and AT port, then run gcom scripts from /etc/gcom/ to read ICCID, IMSI and IMEI.')),
					E('li', {}, _('Send email and SMS through configured API URLs using key and shared secret authentication.')),
					E('li', {}, _('Write device-local event history to the configured log path.')),
					E('li', {}, _('Never require cloud polling for these device alerts.'))
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

'use strict';
'require fs';
'require poll';
'require view';

function statusClass(status) {
	if (status === 'ok')
		return 'ifacebadge-active';
	if (status === 'degraded')
		return 'ifacebadge-pending';
	return 'ifacebadge-negative';
}

function renderCheck(value, full) {
	return value >= full ? _('OK') : _('Fail');
}

function renderRows(data) {
	var ifaces = data.interfaces || [];

	if (!ifaces.length)
		return E('tr', { 'class': 'tr placeholder' }, [
			E('td', { 'class': 'td', 'colspan': 6 }, _('No interfaces discovered.'))
		]);

	return ifaces.map(function(iface) {
		var checks = iface.checks || {};
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [
				E('strong', {}, iface.name || '-'),
				iface.device ? E('div', { 'class': 'cbi-value-description' }, iface.device) : '',
				iface.address ? E('div', { 'class': 'cbi-value-description' }, iface.address) : ''
			]),
			E('td', { 'class': 'td' }, E('span', { 'class': 'ifacebadge %s'.format(statusClass(iface.status)) }, iface.status || _('Unknown'))),
			E('td', { 'class': 'td' }, '%d/100'.format(iface.score || 0)),
			E('td', { 'class': 'td' }, iface.latency === '-' ? '-' : '%sms'.format(iface.latency)),
			E('td', { 'class': 'td' }, '%s%%'.format(iface.packet_loss || '0')),
			E('td', { 'class': 'td' }, [
				_('Link: %s').format(renderCheck(checks.link || 0, 15)), E('br'),
				_('IP: %s').format(renderCheck(checks.ip || 0, 15)), E('br'),
				_('Gateway: %s').format(renderCheck(checks.gateway || 0, 15)), E('br'),
				_('Route: %s').format(renderCheck(checks.route || 0, 15)), E('br'),
				_('Ping: %s').format(renderCheck(checks.ping || 0, 20)), E('br'),
				_('DNS: %s').format(renderCheck(checks.dns || 0, 10)), E('br'),
				_('HTTP: %s').format(renderCheck(checks.http || 0, 10))
			])
		]);
	});
}

return view.extend({
	loadStatus: function() {
		return fs.exec_direct('/usr/libexec/internet-healthd-status')
			.then(function(raw) {
				try {
					return JSON.parse(raw || '{}');
				} catch (e) {
					return { timestamp: 0, discovery: 'all', interfaces: [] };
				}
			});
	},

	loadLog: function() {
		return fs.exec_direct('/usr/libexec/internet-healthd-status', [ 'log', '20' ])
			.catch(function() { return ''; });
	},

	pollStatus: function() {
		var table = document.getElementById('internet-healthd-status');
		var log = document.getElementById('internet-healthd-log');

		return Promise.all([ this.loadStatus(), this.loadLog() ]).then(function(data) {
			if (table)
				table.replaceChildren.apply(table, renderRows(data[0]));
			if (log)
				log.value = data[1] || '';
		});
	},

	load: function() {
		poll.add(this.pollStatus.bind(this));
		return Promise.all([ this.loadStatus(), this.loadLog() ]);
	},

	render: function(data) {
		var status = data[0] || {};
		var log = data[1] || '';

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Internet Health')),
			E('div', { 'class': 'cbi-map-descr' }, _('Interfaces are logical netifd names; the active L3 device and address are shown below each name.')),
			E('div', { 'class': 'cbi-section' }, [
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Interface')),
						E('th', { 'class': 'th' }, _('Status')),
						E('th', { 'class': 'th' }, _('Score')),
						E('th', { 'class': 'th' }, _('Latency')),
						E('th', { 'class': 'th' }, _('Packet Loss')),
						E('th', { 'class': 'th' }, _('Checks'))
					]),
					E('tbody', { 'id': 'internet-healthd-status' }, renderRows(status))
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Recent events')),
				E('textarea', {
					'id': 'internet-healthd-log',
					'readonly': 'readonly',
					'wrap': 'off',
					'style': 'width:100%; font-family:monospace',
					'rows': 10
				}, [ log ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

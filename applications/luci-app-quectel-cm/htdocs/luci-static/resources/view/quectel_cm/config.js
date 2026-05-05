'use strict';
'require dom';
'require form';
'require fs';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

function serviceStatusText(running) {
	return running ? _('Running') : _('Stopped');
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('qtcm'),
			callServiceList('qtcm').catch(function() { return {}; })
		]);
	},

	render: function() {
		var map = new form.Map('qtcm', _('QTCM'),
			_('Configure QTCM dialing settings and manage the qtcm service for quectel-CM.'));
		var section = map.section(form.NamedSection, 'main', 'qtcm', _('Connection Settings'));
		var statusNode = E('div', { 'class': 'cbi-section-descr' }, _('Checking service status...'));
		var pdnSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': '1' }, _('Profile 1')),
			E('option', { 'value': '2' }, _('Profile 2')),
			E('option', { 'value': '3' }, _('Profile 3')),
			E('option', { 'value': '4' }, _('Profile 4'))
		]);
		var actionRow = E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Runtime Status')),
			statusNode,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcm', [ 'start' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('QTCM service started.')));
							return this.updateStatus(statusNode);
						}, this));
					})
				}, [ _('Start') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcm', [ 'restart' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('QTCM service restarted.')));
							return this.updateStatus(statusNode);
						}, this));
					})
				}, [ _('Restart') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-reset',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcm', [ 'stop' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('QTCM service stopped.')));
							return this.updateStatus(statusNode);
						}, this));
					})
				}, [ _('Stop') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcm', [ 'enable' ]).then(function() {
							ui.addNotification(null, E('p', _('QTCM service enabled at boot.')));
						});
					})
				}, [ _('Enable on Boot') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcm', [ 'disable' ]).then(function() {
							ui.addNotification(null, E('p', _('QTCM service disabled at boot.')));
						});
					})
				}, [ _('Disable on Boot') ])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('label', { 'style': 'margin-right:1em;' }, _('Disconnect PDN')),
				pdnSelect,
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcm', [ 'killpdn', pdnSelect.value ]).then(function() {
							ui.addNotification(null, E('p', _('Requested disconnect for PDN profile %s.').format(pdnSelect.value)));
						});
					})
				}, [ _('Disconnect') ])
			])
		]);
		var o;

		section.tab('basic', _('Basic'));
		section.tab('advanced', _('Advanced'));

		o = section.taboption('basic', form.Flag, 'enabled', _('Enable service'));
		o.rmempty = false;

		o = section.taboption('basic', form.Flag, 'log', _('Enable logging'));
		o.rmempty = false;

		o = section.taboption('basic', form.Value, 'log_file', _('Log file'));
		o.placeholder = '/tmp/q-cm.log';
		o.depends('log', '1');

		o = section.taboption('basic', form.ListValue, 'cell_internet_mode', _('Internet mode'));
		o.value('nat', _('Routed / NAT'));
		o.value('ippt', _('IP passthrough / bridge'));
		o.default = 'nat';

		o = section.taboption('basic', form.ListValue, 'pdp', _('PDP context'));
		o.value('1', _('Profile 1'));
		o.value('2', _('Profile 2'));
		o.value('3', _('Profile 3'));
		o.value('4', _('Profile 4'));
		o.default = '1';

		o = section.taboption('basic', form.ListValue, 'ip_type', _('IP type'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.value('ipv4v6', _('IPv4 / IPv6'));
		o.default = 'ipv4';

		o = section.taboption('basic', form.Flag, 'auto_apn', _('Automatic APN'));
		o.rmempty = false;
		o.default = '1';

		o = section.taboption('basic', form.Value, 'apn', _('APN'));
		o.depends('auto_apn', '0');

		o = section.taboption('basic', form.Value, 'username', _('Username'));
		o.depends('auto_apn', '0');

		o = section.taboption('basic', form.Value, 'password', _('Password'));
		o.password = true;
		o.depends('auto_apn', '0');

		o = section.taboption('basic', form.ListValue, 'auth', _('Authentication'));
		o.value('none', _('None'));
		o.value('pap', _('PAP'));
		o.value('chap', _('CHAP'));
		o.value('mschapv2', _('MSCHAPv2'));
		o.default = 'none';
		o.depends('auto_apn', '0');

		o = section.taboption('advanced', form.Value, 'network_interface', _('Network interface'));
		o.placeholder = 'wwan0';
		o.optional = true;

		o = section.taboption('advanced', form.Value, 'at_port', _('AT port'));
		o.placeholder = '/dev/ttyUSB2';
		o.optional = true;

		o = section.taboption('advanced', form.Value, 'pincode', _('SIM PIN'));
		o.password = true;
		o.optional = true;

		o = section.taboption('advanced', form.ListValue, 'proxy_mode', _('Proxy mode'));
		o.value('', _('Disabled'));
		o.value('qmi-proxy', _('libqmi proxy'));
		o.value('mbim-proxy', _('libmbim proxy'));
		o.value('quectel-qmi-proxy', _('Quectel QMI proxy'));
		o.value('quectel-mbim-proxy', _('Quectel MBIM proxy'));
		o.value('quectel-atc-proxy', _('Quectel ATC proxy'));
		o.default = '';

		o = section.taboption('advanced', form.ListValue, 'mux_id', _('MUX interface index'));
		o.value('', _('Disabled'));
		o.value('1', _('Index 1'));
		o.value('2', _('Index 2'));
		o.value('3', _('Index 3'));
		o.value('4', _('Index 4'));
		o.value('5', _('Index 5'));
		o.value('6', _('Index 6'));
		o.value('7', _('Index 7'));
		o.value('8', _('Index 8'));
		o.default = '';

		o = section.taboption('advanced', form.Flag, 'no_dhcp', _('Use internal IP/DNS handling'));
		o.rmempty = false;

		o = section.taboption('advanced', form.Flag, 'verbose', _('Verbose logging'));
		o.rmempty = false;

		o = section.taboption('advanced', form.Value, 'usbmon_log_file', _('USB monitor log file'));
		o.placeholder = '/tmp/quectel-usbmon.log';
		o.optional = true;

		map.onAfterCommit = L.bind(function() {
			return fs.exec('/etc/init.d/qtcm', [ 'restart' ]).then(L.bind(function() {
				ui.addNotification(null, E('p', _('Configuration applied and service restarted.')));
				return this.updateStatus(statusNode);
			}, this)).catch(function(err) {
				ui.addNotification(null, E('p', _('Saved configuration, but restart failed: %s').format(err.message || err)));
			});
		}, this);

		poll.add(L.bind(function() {
			return this.updateStatus(statusNode);
		}, this), 5);

		return map.render().then(L.bind(function(node) {
			node.insertBefore(actionRow, node.firstChild || null);
			return this.updateStatus(statusNode).then(function() {
				return node;
			});
		}, this));
	},

	updateStatus: function(node) {
		return callServiceList('qtcm').then(function(result) {
			var instances = result && result.qtcm && result.qtcm.instances;
			var running = false;

			if (instances) {
				Object.keys(instances).forEach(function(name) {
					if (instances[name].running)
						running = true;
				});
			}

			dom.content(node, E('span', [
				E('strong', _('Service status: ')),
				serviceStatusText(running)
			]));
		}).catch(function() {
			dom.content(node, E('span', _('Service status is unavailable.')));
		});
	}
});

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

function cfgvalue(config, section, option, fallback) {
	var value = uci.get(config, section, option);
	return value != null && value !== '' ? value : fallback;
}

function addIpTypeValues(o) {
	o.value('ipv4', _('IPv4 Only'));
	o.value('ipv6', _('IPv6 Only'));
	o.value('ipv4v6', _('IPv4 / IPv6'));
	o.default = 'ipv4';
}

function addNetworkModeValues(o) {
	o.value('auto', _('Auto'));
	o.value('2g', _('2G Only'));
	o.value('3g', _('3G Only'));
	o.value('4g', _('4G Only'));
	o.value('5g', _('5G Only'));
	o.default = 'auto';
}

function addFirewallZoneValues(o) {
	o.value('', _('unspecified'));

	uci.sections('firewall', 'zone', function(zone) {
		if (zone.name)
			o.value(zone.name, zone.name);
	});
}

function addSimSection(map, sectionId, label, simNo) {
	var section = map.section(form.NamedSection, sectionId, 'sim',
		_('%s%s').format(label, cfgvalue('qtcm', 'main', 'active_sim', '1') == String(simNo) ? _(' (Active)') : ''));
	var o;

	o = section.option(form.DummyValue, '_active', _('Active SIM'));
	o.rawhtml = true;
	o.cfgvalue = function() {
		return cfgvalue('qtcm', 'main', 'active_sim', '1') == String(simNo)
			? E('strong', _('Active'))
			: E('span', _('Inactive'));
	};

	o = section.option(form.Button, '_set_active', _('Set Active'));
	o.inputtitle = _('Set Active');
	o.inputstyle = 'apply';
	o.onclick = function() {
		uci.set('qtcm', 'main', 'active_sim', String(simNo));

		return uci.save()
			.then(L.bind(L.ui.changes.init, L.ui.changes))
			.then(L.bind(L.ui.changes.displayChanges, L.ui.changes))
			.then(function() {
				ui.addNotification(null, E('p', _('%s selected as active SIM. Apply changes to make it persistent.').format(label)));
			});
	};

	o = section.option(form.Flag, 'enabled', _('Enable'));
	o.rmempty = false;

	o = section.option(form.Value, 'description', _('Description'));
	o.optional = true;

	o = section.option(form.Value, 'apn', _('APN'));
	o.placeholder = 'internet';
	o.optional = true;

	o = section.option(form.ListValue, 'network_mode', _('Network Mode'));
	addNetworkModeValues(o);

	o = section.option(form.ListValue, 'ip_type', _('Network Type'));
	addIpTypeValues(o);

	o = section.option(form.Value, 'pin', _('PIN'));
	o.password = true;
	o.optional = true;

	o = section.option(form.Value, 'username', _('APN Username'));
	o.optional = true;

	o = section.option(form.Value, 'password', _('APN Password'));
	o.password = true;
	o.optional = true;

	o = section.option(form.Value, 'metric', _('Metric'));
	o.datatype = 'uinteger';
	o.optional = true;

	o = section.option(form.Value, 'mtu', _('MTU'));
	o.datatype = 'range(576,9200)';
	o.optional = true;

	o = section.option(form.Value, 'lock_pin', _('Lock PIN'));
	o.password = true;
	o.optional = true;

	o = section.option(form.ListValue, 'firewall_zone', _('Firewall Zone'));
	addFirewallZoneValues(o);
	o.optional = true;

	o = section.option(form.Flag, 'use_dns', _('Use DNS'));
	o.rmempty = false;
	o.default = '1';
}

function addFailoverSection(map) {
	var section = map.section(form.NamedSection, 'failover', 'failover', _('SIM Failover Monitoring'));
	var o;

	function addPriorityValues(opt) {
		opt.value('', _('None'));
		opt.value('internet', _('Internet Failure'));
		opt.value('snr', _('SNR'));
		opt.value('latency', _('Link Latency'));
		opt.value('quota', _('SIM Quota Max'));
		opt.value('rssi', _('RSSI'));
	}

	o = section.option(form.Flag, 'enabled', _('Enable Failover Monitor'));
	o.rmempty = false;

	o = section.option(form.ListValue, 'priority_1', _('Priority 1'));
	addPriorityValues(o);
	o.default = 'internet';

	o = section.option(form.ListValue, 'priority_2', _('Priority 2'));
	addPriorityValues(o);
	o.default = 'rssi';

	o = section.option(form.ListValue, 'priority_3', _('Priority 3'));
	addPriorityValues(o);
	o.default = 'latency';

	o = section.option(form.ListValue, 'priority_4', _('Priority 4'));
	addPriorityValues(o);
	o.default = 'quota';

	o = section.option(form.ListValue, 'priority_5', _('Priority 5'));
	addPriorityValues(o);
	o.default = 'snr';

	o = section.option(form.Flag, 'check_internet_failure', _('Check Internet Failure'));
	o.rmempty = false;
	o.default = '1';

	o = section.option(form.Flag, 'check_signal_strength', _('Check Signal Strength'));
	o.rmempty = false;
	o.default = '1';

	o = section.option(form.Value, 'switch_above_signal', _('Switch Above Signal (dBm)'));
	o.datatype = 'integer';
	o.placeholder = '75';

	o = section.option(form.Flag, 'check_snr', _('Check SNR'));
	o.rmempty = false;

	o = section.option(form.Value, 'minimum_snr', _('Minimum SNR (dB)'));
	o.datatype = 'integer';
	o.placeholder = '5';

	o = section.option(form.Value, 'flap_wait', _('SIM Flapping Protection Wait (Seconds)'), _('Default 300s'));
	o.datatype = 'uinteger';
	o.placeholder = '300';

	o = section.option(form.Flag, 'enable_network_reboot', _('Enable Network Reboot'));
	o.rmempty = false;

	o = section.option(form.Value, 'reboot_on_network_loss', _('Reboot on Network Loss (Seconds)'), _('Default 1800s'));
	o.datatype = 'uinteger';
	o.placeholder = '1800';

	o = section.option(form.Flag, 'check_ping_status', _('Check Ping Status'));
	o.rmempty = false;

	o = section.option(form.DynamicList, 'ping_ipv4_ips', _('Ping IPs'), _('IPv4 IPs are pinged only when SIM is used in IPv4 mode'));
	o.datatype = 'ip4addr';
	o.placeholder = '8.8.8.8';

	o = section.option(form.DynamicList, 'ping_ipv6_ips', _('Ping IPv6 IPs'), _('IPv6 IPs are pinged only when SIM is used in IPv6 mode'));
	o.datatype = 'ip6addr';

	o = section.option(form.Value, 'minimum_responses', _('Minimum Responses'));
	o.datatype = 'uinteger';
	o.placeholder = '1';

	o = section.option(form.Value, 'minimum_ping_responses', _('Minimum Ping Responses'));
	o.datatype = 'uinteger';
	o.placeholder = '1';

	o = section.option(form.Value, 'response_timeout', _('Response Timeout'));
	o.datatype = 'uinteger';
	o.placeholder = '10';

	o = section.option(form.Flag, 'check_link_performance', _('Check Link Performance'));
	o.rmempty = false;

	o = section.option(form.Value, 'failure_latency', _('Failure Latency (ms)'));
	o.datatype = 'uinteger';
	o.placeholder = '450';

	o = section.option(form.Value, 'acceptable_latency', _('Acceptable Latency (ms)'));
	o.datatype = 'uinteger';
	o.placeholder = '200';

	o = section.option(form.Flag, 'check_data_usage', _('Check Data Usage'));
	o.rmempty = false;

	o = section.option(form.Value, 'sim1_quota_day', _('SIM1 Quota Per Day (GB)'));
	o.datatype = 'uinteger';
	o.placeholder = '2';

	o = section.option(form.Value, 'sim2_quota_day', _('SIM2 Quota Per Day (GB)'));
	o.datatype = 'uinteger';
	o.placeholder = '2';

	o = section.option(form.Value, 'link_check_interval', _('Link Check Interval (Seconds)'));
	o.datatype = 'uinteger';
	o.placeholder = '180';

	o = section.option(form.Flag, 'restart_qtcm_after_switch', _('Restart QTCM After SIM Switch'));
	o.rmempty = false;
	o.default = '1';

	o = section.option(form.Value, 'post_switch_hook', _('Post Switch Script'),
		_('Optional executable called after failover switches SIM. Arguments: new_sim old_sim reason interface signal_dbm.'));
	o.placeholder = '/usr/libexec/qtcmsim-switch-hook';
	o.optional = true;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('qtcm'),
			uci.load('firewall'),
			callServiceList('qtcm').catch(function() { return {}; })
		]);
	},

	render: function() {
		var map = new form.Map('qtcm', _('QTCM'),
			_('Configure QTCM dialing settings and manage the qtcm service for quectel-CM.'));
		var section = map.section(form.NamedSection, 'main', 'qtcm', _('Connection Settings'));
		var statusNode = E('div', { 'class': 'cbi-section-descr' }, _('Checking service status...'));
		var failoverStatusNode = E('div', { 'class': 'cbi-section-descr' }, _('Checking failover monitor status...'));
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
			E('h3', _('Failover Monitor')),
			failoverStatusNode,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'start' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('Failover monitor started.')));
							return this.updateServiceStatus('qtcmsim-failover', failoverStatusNode, _('Failover monitor status: '));
						}, this));
					})
				}, [ _('Start') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'restart' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('Failover monitor restarted.')));
							return this.updateServiceStatus('qtcmsim-failover', failoverStatusNode, _('Failover monitor status: '));
						}, this));
					})
				}, [ _('Restart') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-reset',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'stop' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('Failover monitor stopped.')));
							return this.updateServiceStatus('qtcmsim-failover', failoverStatusNode, _('Failover monitor status: '));
						}, this));
					})
				}, [ _('Stop') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'enable' ]).then(function() {
							ui.addNotification(null, E('p', _('Failover monitor enabled at boot.')));
						});
					})
				}, [ _('Enable on Boot') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'disable' ]).then(function() {
							ui.addNotification(null, E('p', _('Failover monitor disabled at boot.')));
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
		addIpTypeValues(o);

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

		o = section.taboption('advanced', form.ListValue, 'active_sim', _('Active SIM'));
		o.value('1', _('SIM 1'));
		o.value('2', _('SIM 2'));
		o.default = '1';

		addSimSection(map, 'sim1', _('SIM 1'), 1);
		addSimSection(map, 'sim2', _('SIM 2'), 2);
		addFailoverSection(map);

		map.onAfterCommit = L.bind(function() {
			return fs.exec('/etc/init.d/qtcm', [ 'restart' ]).then(L.bind(function() {
				ui.addNotification(null, E('p', _('Configuration applied and service restarted.')));
				return fs.exec('/etc/init.d/qtcmsim-failover', [ 'restart' ]).catch(function() {}).then(L.bind(function() {
					return Promise.all([
						this.updateStatus(statusNode),
						this.updateServiceStatus('qtcmsim-failover', failoverStatusNode, _('Failover monitor status: '))
					]);
				}, this));
			}, this)).catch(function(err) {
				ui.addNotification(null, E('p', _('Saved configuration, but restart failed: %s').format(err.message || err)));
			});
		}, this);

		poll.add(L.bind(function() {
			return Promise.all([
				this.updateStatus(statusNode),
				this.updateServiceStatus('qtcmsim-failover', failoverStatusNode, _('Failover monitor status: '))
			]);
		}, this), 5);

		return map.render().then(L.bind(function(node) {
			node.insertBefore(actionRow, node.firstChild || null);
			return Promise.all([
				this.updateStatus(statusNode),
				this.updateServiceStatus('qtcmsim-failover', failoverStatusNode, _('Failover monitor status: '))
			]).then(function() {
				return node;
			});
		}, this));
	},

	updateStatus: function(node) {
		return this.updateServiceStatus('qtcm', node, _('Service status: '));
	},

	updateServiceStatus: function(name, node, label) {
		return callServiceList(name).then(function(result) {
			var service = result && result[name];
			var instances = service && service.instances;
			var running = false;

			if (instances) {
				Object.keys(instances).forEach(function(name) {
					if (instances[name].running)
						running = true;
				});
			}

			dom.content(node, E('span', [
				E('strong', label),
				serviceStatusText(running)
			]));
		}).catch(function() {
			dom.content(node, E('span', _('%s is unavailable.').format(label)));
		});
	}
});

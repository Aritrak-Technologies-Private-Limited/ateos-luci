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

function failoverEnabled() {
	return cfgvalue('qtcm', 'failover', 'enabled', '0') == '1';
}

function activeSimFromGpio() {
	var mode = cfgvalue('qtcm', 'sim_switch', 'mode', 'gpio');
	var value = cfgvalue('system', 'sim_switch', 'value', '');
	var sim1Value = cfgvalue('qtcm', 'sim_switch', 'sim1_value', '1');
	var sim2Value = cfgvalue('qtcm', 'sim_switch', 'sim2_value', '0');

	if (mode != 'gpio')
		return '';

	if (value == sim1Value)
		return '1';

	if (value == sim2Value)
		return '2';

	return '';
}

function activeSimValue() {
	return activeSimFromGpio() || cfgvalue('qtcm', 'main', 'active_sim', '1');
}

function activeSimSourceText() {
	var mode = cfgvalue('qtcm', 'sim_switch', 'mode', 'gpio');

	if (mode == 'gpio' && activeSimFromGpio())
		return _('GPIO state');

	if (mode == 'module')
		return _('module switch state');

	return _('QTCM configuration');
}

function parentSection(node) {
	while (node && node.parentNode) {
		if (node.classList && node.classList.contains('cbi-section'))
			return node;

		node = node.parentNode;
	}

	return null;
}

function arrangeSimSections(node) {
	var sim1Node = node.querySelector('#cbi-qtcm-sim1');
	var sim2Node = node.querySelector('#cbi-qtcm-sim2');
	var sim1Section = parentSection(sim1Node);
	var sim2Section = parentSection(sim2Node);
	var grid;

	if (!sim1Section || !sim2Section || sim1Section.parentNode !== sim2Section.parentNode)
		return;

	if (!node.querySelector('#qtcm-sim-grid-style')) {
		node.insertBefore(E('style', { 'id': 'qtcm-sim-grid-style' }, [
			'.qtcm-sim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;align-items:start}',
			'.qtcm-sim-grid>.cbi-section{margin:0;min-width:0}',
			'.qtcm-sim-grid .cbi-value{display:grid;grid-template-columns:11rem minmax(0,1fr);gap:.75rem;align-items:center;margin:.7rem 0}',
			'.qtcm-sim-grid .cbi-value-title{float:none;width:auto;min-width:0;padding:0;text-align:right;line-height:1.4}',
			'.qtcm-sim-grid .cbi-value-field{margin:0;min-width:0;display:flex;align-items:center;gap:.4rem}',
			'.qtcm-sim-grid .cbi-value-field input:not([type="checkbox"]):not([type="radio"]),.qtcm-sim-grid .cbi-value-field select{width:100%;max-width:100%;box-sizing:border-box}',
			'.qtcm-sim-grid .cbi-value-field .cbi-button{flex:0 0 auto}',
			'.qtcm-sim-grid .cbi-value-field output{display:inline-block;line-height:1.4}',
			'@media(max-width:1200px){.qtcm-sim-grid .cbi-value{grid-template-columns:9rem minmax(0,1fr)}}',
			'@media(max-width:900px){.qtcm-sim-grid{grid-template-columns:1fr}.qtcm-sim-grid .cbi-value{grid-template-columns:11rem minmax(0,1fr)}}',
			'@media(max-width:520px){.qtcm-sim-grid .cbi-value{grid-template-columns:1fr}.qtcm-sim-grid .cbi-value-title{text-align:left}}'
		]), node.firstChild || null);
	}

	grid = E('div', { 'class': 'qtcm-sim-grid' });
	sim1Section.parentNode.insertBefore(grid, sim1Section);
	grid.appendChild(sim1Section);
	grid.appendChild(sim2Section);
}

function addSimSection(map, sectionId, label, simNo) {
	var failoverControlsActive = failoverEnabled();
	var section = map.section(form.NamedSection, sectionId, 'sim',
		_('%s%s').format(label, activeSimValue() == String(simNo)
			? (failoverControlsActive ? _(' (Failover Active)') : _(' (Active)'))
			: ''));
	var o;

	o = section.option(form.DummyValue, '_active', _('Active SIM'), _('Shows whether this SIM is currently selected.'));
	o.rawhtml = true;
	o.cfgvalue = function() {
		var active = activeSimValue() == String(simNo);

		return active
			? E('strong', failoverControlsActive ? _('Active (failover)') : _('Active'))
			: E('span', _('Inactive'));
	};

	if (!failoverControlsActive) {
		o = section.option(form.Button, '_set_active', _('Set Active'), _('Manually switch to this SIM when failover is disabled.'));
		o.inputtitle = _('Set Active');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return fs.exec('/usr/libexec/qtcm-manual-sim-switch', [ String(simNo) ])
				.then(function() {
					ui.addNotification(null, E('p', _('%s selected as active SIM.').format(label)));
					window.location.reload();
				})
				.catch(function(err) {
					ui.addNotification(null, E('p', _('Unable to switch active SIM: %s').format(err.message || err)));
				});
		};
	}

	o = section.option(form.Flag, 'enabled', _('Enable'), _('Allow this SIM to be used by manual switching and failover.'));
	o.rmempty = false;

	o = section.option(form.Value, 'description', _('Description'), _('Optional label for identifying this SIM.'));
	o.optional = true;

	o = section.option(form.Value, 'apn', _('APN'), _('Carrier APN used for this SIM.'));
	o.placeholder = 'internet';
	o.optional = true;

	o = section.option(form.ListValue, 'network_mode', _('Network Mode'), _('Preferred radio mode for this SIM.'));
	addNetworkModeValues(o);

	o = section.option(form.ListValue, 'ip_type', _('Network Type'), _('IP family requested for this SIM data session.'));
	addIpTypeValues(o);

	o = section.option(form.Value, 'pin', _('PIN'), _('SIM PIN if the SIM requires unlocking.'));
	o.password = true;
	o.optional = true;

	o = section.option(form.Value, 'username', _('APN Username'), _('Carrier APN username, if required.'));
	o.optional = true;

	o = section.option(form.Value, 'password', _('APN Password'), _('Carrier APN password, if required.'));
	o.password = true;
	o.optional = true;

	o = section.option(form.Value, 'metric', _('Metric'), _('Route metric used when this SIM connection is active.'));
	o.datatype = 'uinteger';
	o.optional = true;

	o = section.option(form.Value, 'mtu', _('MTU'), _('Interface MTU for the cellular data link.'));
	o.datatype = 'range(576,9200)';
	o.optional = true;

	o = section.option(form.Value, 'lock_pin', _('Lock PIN'), _('PIN used when enabling SIM PIN lock.'));
	o.password = true;
	o.optional = true;

	o = section.option(form.ListValue, 'firewall_zone', _('Firewall Zone'), _('Firewall zone assigned to this SIM data interface.'));
	addFirewallZoneValues(o);
	o.optional = true;

	o = section.option(form.Flag, 'use_dns', _('Use DNS'), _('Use DNS servers learned from this SIM connection.'));
	o.rmempty = false;
	o.default = '1';
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('qtcm'),
			uci.load('firewall'),
			uci.load('system'),
			callServiceList('qtcm').catch(function() { return {}; })
		]);
	},

	render: function() {
		var map = new form.Map('qtcm');
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

		o = section.taboption('basic', form.Flag, 'enabled', _('Enable service'), _('Start QTCM modem connection management.'));
		o.rmempty = false;

		o = section.taboption('basic', form.Flag, 'log', _('Enable logging'), _('Write QTCM service logs to the configured file.'));
		o.rmempty = false;

		o = section.taboption('basic', form.Value, 'log_file', _('Log file'), _('Path used for QTCM service logging.'));
		o.placeholder = '/tmp/q-cm.log';
		o.depends('log', '1');

		o = section.taboption('basic', form.ListValue, 'cell_internet_mode', _('Internet mode'), _('Choose routed NAT mode or IP passthrough mode.'));
		o.value('nat', _('Routed / NAT'));
		o.value('ippt', _('IP passthrough / bridge'));
		o.default = 'nat';

		o = section.taboption('basic', form.ListValue, 'pdp', _('PDP context'), _('Modem profile number used for the data session.'));
		o.value('1', _('Profile 1'));
		o.value('2', _('Profile 2'));
		o.value('3', _('Profile 3'));
		o.value('4', _('Profile 4'));
		o.default = '1';

		o = section.taboption('basic', form.ListValue, 'ip_type', _('IP type'), _('IP family requested for the main data connection.'));
		addIpTypeValues(o);

		o = section.taboption('basic', form.Flag, 'auto_apn', _('Automatic APN'), _('Let the modem or carrier profile choose APN settings.'));
		o.rmempty = false;
		o.default = '1';

		o = section.taboption('basic', form.Value, 'apn', _('APN'), _('Manual APN used when Automatic APN is disabled.'));
		o.depends('auto_apn', '0');

		o = section.taboption('basic', form.Value, 'username', _('Username'), _('APN username, if your carrier requires one.'));
		o.depends('auto_apn', '0');

		o = section.taboption('basic', form.Value, 'password', _('Password'), _('APN password, if your carrier requires one.'));
		o.password = true;
		o.depends('auto_apn', '0');

		o = section.taboption('basic', form.ListValue, 'auth', _('Authentication'), _('Authentication method required by the carrier APN.'));
		o.value('none', _('None'));
		o.value('pap', _('PAP'));
		o.value('chap', _('CHAP'));
		o.value('mschapv2', _('MSCHAPv2'));
		o.default = 'none';
		o.depends('auto_apn', '0');

		o = section.taboption('advanced', form.Value, 'network_interface', _('Network interface'), _('Linux interface name used by QTCM, for example usb0 or wwan0.'));
		o.placeholder = 'wwan0';
		o.optional = true;

		o = section.taboption('advanced', form.Value, 'at_port', _('AT port'), _('Modem AT command port used for status and control.'));
		o.placeholder = '/dev/ttyUSB2';
		o.optional = true;

		o = section.taboption('advanced', form.Value, 'pincode', _('SIM PIN'), _('PIN used to unlock the active SIM if required.'));
		o.password = true;
		o.optional = true;

		o = section.taboption('advanced', form.ListValue, 'proxy_mode', _('Proxy mode'), _('Optional QMI, MBIM, or Quectel proxy mode.'));
		o.value('', _('Disabled'));
		o.value('qmi-proxy', _('libqmi proxy'));
		o.value('mbim-proxy', _('libmbim proxy'));
		o.value('quectel-qmi-proxy', _('Quectel QMI proxy'));
		o.value('quectel-mbim-proxy', _('Quectel MBIM proxy'));
		o.value('quectel-atc-proxy', _('Quectel ATC proxy'));
		o.default = '';

		o = section.taboption('advanced', form.ListValue, 'mux_id', _('MUX interface index'), _('Optional multiplexed data channel index.'));
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

		o = section.taboption('advanced', form.Flag, 'no_dhcp', _('Use internal IP/DNS handling'), _('Let QTCM apply IP and DNS details instead of DHCP.'));
		o.rmempty = false;

		o = section.taboption('advanced', form.Flag, 'verbose', _('Verbose logging'), _('Enable more detailed QTCM diagnostic logs.'));
		o.rmempty = false;

		o = section.taboption('advanced', form.Value, 'usbmon_log_file', _('USB monitor log file'), _('Path for optional USB monitor logging.'));
		o.placeholder = '/tmp/quectel-usbmon.log';
		o.optional = true;

		var switchSection = map.section(form.NamedSection, 'sim_switch', 'sim_switch', _('SIM Switch Backend'));

		o = switchSection.option(form.ListValue, 'mode', _('Switch mode'), _('How this hardware changes between SIM slots.'));
		o.value('gpio', _('External GPIO'));
		o.value('module', _('Module AT command'));
		o.value('none', _('None'));
		o.default = 'gpio';

		o = switchSection.option(form.Value, 'sim1_value', _('SIM 1 value'), _('GPIO value or module command value that selects SIM 1.'));
		o.placeholder = '1';

		o = switchSection.option(form.Value, 'sim2_value', _('SIM 2 value'), _('GPIO value or module command value that selects SIM 2.'));
		o.placeholder = '0';

		o = switchSection.option(form.Value, 'command', _('Module switch command'), _('AT command prefix used when switch mode is module.'));
		o.placeholder = 'AT+QDSIM';
		o.depends('mode', 'module');

		o = switchSection.option(form.Flag, 'power_cycle_mpcie', _('Power-cycle mPCIe after switch'), _('Toggle mPCIe power after changing SIM so the modem re-detects the slot.'));
		o.rmempty = false;
		o.default = '1';

		if (!failoverEnabled()) {
			o = section.taboption('advanced', form.ListValue, 'active_sim', _('Active SIM'), _('SIM selected when failover is disabled.'));
			o.value('1', _('SIM 1'));
			o.value('2', _('SIM 2'));
			o.default = '1';
		} else {
			o = section.taboption('advanced', form.DummyValue, '_active_sim_failover', _('Active SIM'), _('Read-only while failover controls SIM selection.'));
			o.rawhtml = true;
			o.cfgvalue = function() {
				return E('span', activeSimValue() == '2'
					? _('SIM 2 (controlled by failover, read from %s)').format(activeSimSourceText())
					: _('SIM 1 (controlled by failover, read from %s)').format(activeSimSourceText()));
			};
		}

		addSimSection(map, 'sim1', _('SIM 1'), 1);
		addSimSection(map, 'sim2', _('SIM 2'), 2);

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
			arrangeSimSections(node);
			return this.updateStatus(statusNode).then(function() {
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

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

function addPriorityValues(opt) {
	opt.value('', _('None'));
	opt.value('internet', _('Internet Failure'));
	opt.value('snr', _('SNR'));
	opt.value('latency', _('Link Latency'));
	opt.value('quota', _('SIM Quota Max'));
	opt.value('rssi', _('RSSI'));
}

function addFailoverSection(map) {
	var section = map.section(form.NamedSection, 'failover', 'failover', _('SIM Failover Monitoring'));
	var o;

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
	o.placeholder = '/etc/qtcm_custom_failover_script.sh';
	o.optional = true;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('qtcm'),
			callServiceList('qtcmsim-failover').catch(function() { return {}; })
		]);
	},

	render: function() {
		var map = new form.Map('qtcm', _('SIM Failover Monitoring'));
		var statusNode = E('div', { 'class': 'cbi-section-descr' }, _('Checking failover monitor status...'));
		var actionRow = E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Failover Monitor')),
			statusNode,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'start' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('Failover monitor started.')));
							return this.updateStatus(statusNode);
						}, this));
					})
				}, [ _('Start') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'restart' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('Failover monitor restarted.')));
							return this.updateStatus(statusNode);
						}, this));
					})
				}, [ _('Restart') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-reset',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/etc/init.d/qtcmsim-failover', [ 'stop' ]).then(L.bind(function() {
							ui.addNotification(null, E('p', _('Failover monitor stopped.')));
							return this.updateStatus(statusNode);
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
			])
		]);

		addFailoverSection(map);

		map.onAfterCommit = L.bind(function() {
			return fs.exec('/etc/init.d/qtcmsim-failover', [ 'restart' ]).then(L.bind(function() {
				ui.addNotification(null, E('p', _('Failover configuration applied and monitor restarted.')));
				return this.updateStatus(statusNode);
			}, this)).catch(function(err) {
				ui.addNotification(null, E('p', _('Saved failover configuration, but restart failed: %s').format(err.message || err)));
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
		return callServiceList('qtcmsim-failover').then(function(result) {
			var service = result && result['qtcmsim-failover'];
			var instances = service && service.instances;
			var running = false;

			if (instances) {
				Object.keys(instances).forEach(function(name) {
					if (instances[name].running)
						running = true;
				});
			}

			dom.content(node, E('span', [
				E('strong', _('Failover monitor status: ')),
				serviceStatusText(running)
			]));
		}).catch(function() {
			dom.content(node, E('span', _('Failover monitor status is unavailable.')));
		});
	}
});

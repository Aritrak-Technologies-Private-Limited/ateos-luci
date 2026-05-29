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

	o = section.option(form.Flag, 'enabled', _('Enable Failover Monitor'), _('Run automatic SIM failover checks in the background.'));
	o.rmempty = false;

	o = section.option(form.ListValue, 'priority_1', _('Priority 1'), _('First condition checked when deciding whether to switch SIM.'));
	addPriorityValues(o);
	o.default = 'internet';

	o = section.option(form.ListValue, 'priority_2', _('Priority 2'), _('Second condition checked if enabled.'));
	addPriorityValues(o);
	o.default = 'rssi';

	o = section.option(form.ListValue, 'priority_3', _('Priority 3'), _('Third condition checked if enabled.'));
	addPriorityValues(o);
	o.default = 'latency';

	o = section.option(form.ListValue, 'priority_4', _('Priority 4'), _('Fourth condition checked if enabled.'));
	addPriorityValues(o);
	o.default = 'quota';

	o = section.option(form.ListValue, 'priority_5', _('Priority 5'), _('Fifth condition checked if enabled.'));
	addPriorityValues(o);
	o.default = 'snr';

	o = section.option(form.Flag, 'check_internet_failure', _('Check Internet Failure'), _('Switch when ping checks show no usable internet.'));
	o.rmempty = false;
	o.default = '1';

	o = section.option(form.Flag, 'check_signal_strength', _('Check Signal Strength'), _('Switch when signal strength is below the configured threshold.'));
	o.rmempty = false;
	o.default = '1';

	o = section.option(form.Value, 'switch_above_signal', _('Switch Above Signal (dBm)'), _('Absolute dBm threshold. Example: 75 means switch below -75 dBm.'));
	o.datatype = 'integer';
	o.placeholder = '75';
	o.depends('check_signal_strength', '1');

	o = section.option(form.Flag, 'check_snr', _('Check SNR'), _('Switch when SNR is lower than the minimum value.'));
	o.rmempty = false;

	o = section.option(form.Value, 'minimum_snr', _('Minimum SNR (dB)'), _('Lowest acceptable SNR before failover is triggered.'));
	o.datatype = 'integer';
	o.placeholder = '5';
	o.depends('check_snr', '1');

	o = section.option(form.Value, 'flap_wait', _('SIM Flapping Protection Wait (Seconds)'), _('Minimum time between automatic SIM switches to avoid rapid bouncing.'));
	o.datatype = 'uinteger';
	o.placeholder = '300';

	o = section.option(form.Flag, 'enable_network_reboot', _('Enable Network Reboot'), _('Reboot the router if network loss continues longer than the reboot timeout.'));
	o.rmempty = false;

	o = section.option(form.Value, 'reboot_on_network_loss', _('Reboot on Network Loss (Seconds)'), _('How long network loss must continue before rebooting the router.'));
	o.datatype = 'uinteger';
	o.placeholder = '1800';
	o.depends('enable_network_reboot', '1');

	o = section.option(form.Flag, 'check_ping_status', _('Check Ping Status'), _('Use ping replies to decide internet availability.'));
	o.rmempty = false;

	o = section.option(form.DynamicList, 'ping_ipv4_ips', _('Ping IPs'), _('IPv4 IPs are pinged only when SIM is used in IPv4 mode'));
	o.datatype = 'ip4addr';
	o.placeholder = '8.8.8.8';
	o.depends('check_ping_status', '1');
	o.depends('check_internet_failure', '1');

	o = section.option(form.DynamicList, 'ping_ipv6_ips', _('Ping IPv6 IPs'), _('IPv6 IPs are pinged only when SIM is used in IPv6 mode'));
	o.datatype = 'ip6addr';
	o.depends('check_ping_status', '1');
	o.depends('check_internet_failure', '1');

	o = section.option(form.Value, 'minimum_responses', _('Minimum Responses'), _('Reserved compatibility value for response-based checks.'));
	o.datatype = 'uinteger';
	o.placeholder = '1';

	o = section.option(form.Value, 'minimum_ping_responses', _('Minimum Ping Responses'), _('Minimum successful ping replies required for internet to be considered working.'));
	o.datatype = 'uinteger';
	o.placeholder = '1';
	o.depends('check_ping_status', '1');
	o.depends('check_internet_failure', '1');

	o = section.option(form.Value, 'response_timeout', _('Response Timeout'), _('Seconds to wait for each ping reply.'));
	o.datatype = 'uinteger';
	o.placeholder = '10';
	o.depends('check_ping_status', '1');
	o.depends('check_internet_failure', '1');

	o = section.option(form.Flag, 'check_link_performance', _('Check Link Performance'), _('Switch when ping latency is higher than the failure limit.'));
	o.rmempty = false;

	o = section.option(form.Value, 'failure_latency', _('Failure Latency (ms)'), _('Latency at or above this value is treated as failed.'));
	o.datatype = 'uinteger';
	o.placeholder = '450';
	o.depends('check_link_performance', '1');

	o = section.option(form.Value, 'acceptable_latency', _('Acceptable Latency (ms)'), _('Reference value for a healthy link.'));
	o.datatype = 'uinteger';
	o.placeholder = '200';
	o.depends('check_link_performance', '1');

	o = section.option(form.Flag, 'check_data_usage', _('Check Data Usage'), _('Switch when the active SIM crosses its daily quota.'));
	o.rmempty = false;

	o = section.option(form.Value, 'sim1_quota_day', _('SIM1 Quota Per Day (GB)'), _('Daily usage limit for SIM 1 before failover.'));
	o.datatype = 'uinteger';
	o.placeholder = '2';
	o.depends('check_data_usage', '1');

	o = section.option(form.Value, 'sim2_quota_day', _('SIM2 Quota Per Day (GB)'), _('Daily usage limit for SIM 2 before failover.'));
	o.datatype = 'uinteger';
	o.placeholder = '2';
	o.depends('check_data_usage', '1');

	o = section.option(form.Value, 'link_check_interval', _('Link Check Interval (Seconds)'), _('How often the failover monitor runs its checks.'));
	o.datatype = 'uinteger';
	o.placeholder = '180';

	o = section.option(form.Value, 'post_switch_settle_time', _('Post Switch Settle Time (Seconds)'),
		_('Wait after a SIM switch before declaring the new SIM failed.'));
	o.datatype = 'uinteger';
	o.placeholder = '50';

	o = section.option(form.ListValue, 'primary_sim', _('Primary SIM'), _('Preferred SIM used for normal operation.'));
	o.value('1', _('SIM 1'));
	o.value('2', _('SIM 2'));
	o.default = '1';

	o = section.option(form.ListValue, 'backup_sim', _('Backup SIM'), _('SIM used when the primary SIM fails.'));
	o.value('1', _('SIM 1'));
	o.value('2', _('SIM 2'));
	o.default = '2';

	o = section.option(form.Flag, 'enable_primary_failback', _('Auto Retry Primary SIM'), _('Periodically test the primary SIM while running on backup.'));
	o.rmempty = false;

	o = section.option(form.Value, 'primary_retry_interval', _('Primary Retry Interval (Seconds)'), _('How often to try returning to the primary SIM.'));
	o.datatype = 'uinteger';
	o.placeholder = '3600';

	o = section.option(form.Value, 'primary_retry_settle_time', _('Primary Retry Settle Time (Seconds)'), _('Wait after trying primary before deciding whether to stay there.'));
	o.datatype = 'uinteger';
	o.placeholder = '60';

	o = section.option(form.Flag, 'primary_retry_check_internet', _('Check Internet Before Staying on Primary'), _('Return to backup if the primary retry has no internet.'));
	o.rmempty = false;
	o.default = '1';

	o = section.option(form.Flag, 'restart_qtcm_after_switch', _('Restart QTCM After SIM Switch'), _('Restart the modem connection service after changing SIM.'));
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
				}, [ _('Disable on Boot') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/usr/libexec/qtcmsim-failover', [ 'try-primary' ]).then(function() {
							ui.addNotification(null, E('p', _('Primary SIM retry requested.')));
						}).catch(function(err) {
							ui.addNotification(null, E('p', _('Primary SIM retry failed: %s').format(err.message || err)));
						});
					})
				}, [ _('Try Primary SIM') ])
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

'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

function addActionValues(o) {
	o.value('', _('None'));
	o.value('none', _('None'));
	o.value('restart_qtcm', _('Restart QTCM'));
	o.value('power_cycle_mpcie', _('Power-cycle mPCIe'));
	o.value('switch_sim', _('Switch SIM'));
	o.value('reboot_router', _('Reboot Router'));
}

function addOverrideActionValues(o) {
	o.value('', _('Use Global'));
	o.value('none', _('None'));
	o.value('restart_qtcm', _('Restart QTCM'));
	o.value('power_cycle_mpcie', _('Power-cycle mPCIe'));
	o.value('switch_sim', _('Switch SIM'));
	o.value('reboot_router', _('Reboot Router'));
}

function addEventOverrideSection(map, title, prefix, descr) {
	var section = map.section(form.NamedSection, 'troubleshoot', 'troubleshoot', title);
	var o;

	section.description = descr;

	o = section.option(form.ListValue, '%s_action_1'.format(prefix), _('Step 1'), _('First action for this event. Use Global follows the Recovery Sequence.'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_2'.format(prefix), _('Step 2'), _('Second action for this event after another repeated failure.'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_3'.format(prefix), _('Step 3'), _('Third action for this event after repeated failures continue.'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_4'.format(prefix), _('Step 4'), _('Fourth action for this event after earlier actions did not recover service.'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_5'.format(prefix), _('Step 5'), _('Final action for this event.'));
	addOverrideActionValues(o);
	o.default = '';
}

return view.extend({
	load: function() {
		return uci.load('qtcm');
	},

	render: function() {
		var map = new form.Map('qtcm', _('Troubleshoot'));
		var checks = map.section(form.NamedSection, 'troubleshoot', 'troubleshoot', _('Detection Checks'));
		var recovery = map.section(form.NamedSection, 'troubleshoot', 'troubleshoot', _('Recovery Sequence'));
		var o;

		o = checks.option(form.Flag, 'check_sim_error', _('SIM Error'), _('Detect missing SIM, locked SIM, or SIM not ready conditions.'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'sim_error_fail_count', _('SIM Error Fail Count'), _('Number of repeated SIM errors before running a recovery action.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_sim_error', '1');

		o = checks.option(form.Flag, 'check_modem_response', _('Modem Response'), _('Detect when the AT port or modem status commands stop responding.'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'modem_response_fail_count', _('Modem Response Fail Count'), _('Number of modem response failures before recovery.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_modem_response', '1');

		o = checks.option(form.Flag, 'check_interface_ip', _('Interface IP'), _('Detect when the cellular interface has no IP address.'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'interface_ip_fail_count', _('Interface IP Fail Count'), _('Number of no-IP events before recovery.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_interface_ip', '1');

		o = checks.option(form.Flag, 'check_registration', _('Network Registration'), _('Detect when the modem is not registered on the mobile network.'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'registration_fail_count', _('Registration Fail Count'), _('Number of registration failures before recovery.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_registration', '1');

		o = checks.option(form.Flag, 'check_ping', _('Internet Ping'), _('Handle internet failure events reported by failover.'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'ping_fail_count', _('Internet Ping Fail Count'), _('Number of ping failure events before recovery.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_ping', '1');

		o = recovery.option(form.Value, 'recovery_settle_time', _('Settle Time After Action (Seconds)'), _('Wait time after each recovery action before accepting another event.'));
		o.datatype = 'uinteger';
		o.placeholder = '60';

		o = recovery.option(form.ListValue, 'action_1', _('Step 1'), _('First default recovery action.'));
		addActionValues(o);
		o.default = 'restart_qtcm';

		o = recovery.option(form.ListValue, 'action_2', _('Step 2'), _('Second default recovery action if failures continue.'));
		addActionValues(o);
		o.default = 'power_cycle_mpcie';

		o = recovery.option(form.ListValue, 'action_3', _('Step 3'), _('Third default recovery action if failures continue.'));
		addActionValues(o);
		o.default = 'switch_sim';

		o = recovery.option(form.ListValue, 'action_4', _('Step 4'), _('Fourth default recovery action if failures continue.'));
		addActionValues(o);
		o.default = 'reboot_router';

		o = recovery.option(form.ListValue, 'action_5', _('Step 5'), _('Optional final recovery action.'));
		addActionValues(o);
		o.default = '';

		addEventOverrideSection(map, _('SIM Error Actions'), 'sim_error', _('Optional actions used only for SIM error events.'));
		addEventOverrideSection(map, _('Modem Response Actions'), 'modem_response', _('Optional actions used only when the modem stops responding.'));
		addEventOverrideSection(map, _('Interface IP Actions'), 'interface_ip', _('Optional actions used only when the cellular interface has no IP address.'));
		addEventOverrideSection(map, _('Registration Actions'), 'registration', _('Optional actions used only when network registration fails.'));
		addEventOverrideSection(map, _('Internet Ping Actions'), 'ping', _('Optional actions used only after failover reports internet failure.'));

		map.onAfterCommit = function() {
			return fs.exec('/etc/init.d/qtcmsim-failover', [ 'restart' ]).then(function() {
				ui.addNotification(null, E('p', _('Troubleshoot configuration applied and failover monitor restarted.')));
			}).catch(function(err) {
				ui.addNotification(null, E('p', _('Saved troubleshoot configuration, but restart failed: %s').format(err.message || err)));
			});
		};

		return map.render();
	}
});

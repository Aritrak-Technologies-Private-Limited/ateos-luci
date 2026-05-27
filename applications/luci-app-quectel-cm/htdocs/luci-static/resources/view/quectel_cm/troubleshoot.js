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

function addEventOverrideSection(map, title, prefix) {
	var section = map.section(form.NamedSection, 'troubleshoot', 'troubleshoot', title);
	var o;

	o = section.option(form.ListValue, '%s_action_1'.format(prefix), _('Step 1'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_2'.format(prefix), _('Step 2'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_3'.format(prefix), _('Step 3'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_4'.format(prefix), _('Step 4'));
	addOverrideActionValues(o);
	o.default = '';

	o = section.option(form.ListValue, '%s_action_5'.format(prefix), _('Step 5'));
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

		o = checks.option(form.Flag, 'check_sim_error', _('SIM Error'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'sim_error_fail_count', _('SIM Error Fail Count'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_sim_error', '1');

		o = checks.option(form.Flag, 'check_modem_response', _('Modem Response'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'modem_response_fail_count', _('Modem Response Fail Count'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_modem_response', '1');

		o = checks.option(form.Flag, 'check_interface_ip', _('Interface IP'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'interface_ip_fail_count', _('Interface IP Fail Count'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_interface_ip', '1');

		o = checks.option(form.Flag, 'check_registration', _('Network Registration'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'registration_fail_count', _('Registration Fail Count'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_registration', '1');

		o = checks.option(form.Flag, 'check_ping', _('Internet Ping'));
		o.rmempty = false;
		o.default = '1';

		o = checks.option(form.Value, 'ping_fail_count', _('Internet Ping Fail Count'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.depends('check_ping', '1');

		o = recovery.option(form.Value, 'recovery_settle_time', _('Settle Time After Action (Seconds)'));
		o.datatype = 'uinteger';
		o.placeholder = '60';

		o = recovery.option(form.ListValue, 'action_1', _('Step 1'));
		addActionValues(o);
		o.default = 'restart_qtcm';

		o = recovery.option(form.ListValue, 'action_2', _('Step 2'));
		addActionValues(o);
		o.default = 'power_cycle_mpcie';

		o = recovery.option(form.ListValue, 'action_3', _('Step 3'));
		addActionValues(o);
		o.default = 'switch_sim';

		o = recovery.option(form.ListValue, 'action_4', _('Step 4'));
		addActionValues(o);
		o.default = 'reboot_router';

		o = recovery.option(form.ListValue, 'action_5', _('Step 5'));
		addActionValues(o);
		o.default = '';

		addEventOverrideSection(map, _('SIM Error Actions'), 'sim_error');
		addEventOverrideSection(map, _('Modem Response Actions'), 'modem_response');
		addEventOverrideSection(map, _('Interface IP Actions'), 'interface_ip');
		addEventOverrideSection(map, _('Registration Actions'), 'registration');
		addEventOverrideSection(map, _('Internet Ping Actions'), 'ping');

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

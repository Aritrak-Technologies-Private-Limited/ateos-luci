'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

function addChannels(section) {
	var o = section.option(form.MultiValue, 'channel', _('Notify by'));
	o.value('email', _('Email API'));
	o.value('sms', _('SMS API'));
	o.default = ['email'];
	o.rmempty = false;
}

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('event-notifier',
			_('Event Notifier'),
			_('Device-local alert rules. Alerts are evaluated on this router and notifications are sent directly from this router.'));

		s = m.section(form.NamedSection, 'main', 'service', _('Service'));

		o = s.option(form.Flag, 'enabled', _('Enable service'));
		o.default = '0';

		o = s.option(form.Value, 'interval', _('Evaluation interval'), _('How often the local backend checks enabled alert rules, in seconds.'));
		o.datatype = 'uinteger';
		o.placeholder = '60';

		o = s.option(form.Value, 'dedupe_window', _('Repeat suppression'), _('Suppress repeated notifications for the same active alert, in seconds.'));
		o.datatype = 'uinteger';
		o.placeholder = '300';

		o = s.option(form.Value, 'spool_dir', _('Runtime spool directory'));
		o.datatype = 'directory';
		o.placeholder = '/var/run/event-notifier';

		o = s.option(form.Value, 'event_log', _('Local event log'));
		o.datatype = 'file';
		o.placeholder = '/var/log/event-notifier.log';

		s = m.section(form.TypedSection, 'trigger', _('Alert Rules'));
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add alert rule');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';

		o = s.option(form.ListValue, 'type', _('Trigger'));
		o.value('offline', _('Offline'));
		o.value('speed_threshold', _('Speed threshold'));
		o.value('latency', _('Latency'));
		o.value('sim_tampering', _('SIM tampering'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'severity', _('Severity'));
		o.value('info', _('Info'));
		o.value('warning', _('Warning'));
		o.value('critical', _('Critical'));
		o.default = 'warning';

		o = s.option(widgets.NetworkSelect, 'interface', _('Network interface'));
		o.depends({ type: 'offline' });
		o.depends({ type: 'speed_threshold' });
		o.placeholder = 'wan';

		o = s.option(form.DynamicList, 'host', _('Hosts to check'), _('Offline alert fires when all hosts fail for the configured failure count.'));
		o.datatype = 'host';
		o.depends({ type: 'offline' });
		o.placeholder = '8.8.8.8';

		o = s.option(form.Value, 'check_interval', _('Check interval'), _('Seconds between offline checks.'));
		o.datatype = 'uinteger';
		o.depends({ type: 'offline' });
		o.placeholder = '30';

		o = s.option(form.Value, 'timeout', _('Ping timeout'), _('Seconds to wait for each ping response.'));
		o.datatype = 'uinteger';
		o.depends({ type: 'offline' });
		o.placeholder = '5';

		o = s.option(form.Value, 'failures', _('Failure count'), _('Consecutive failed checks before firing the alert.'));
		o.datatype = 'uinteger';
		o.depends({ type: 'offline' });
		o.placeholder = '3';

		o = s.option(form.Value, 'target', _('Target host'));
		o.datatype = 'host';
		o.depends({ type: 'latency' });
		o.placeholder = '8.8.8.8';

		o = s.option(form.Value, 'latency_high', _('High latency threshold'), _('Milliseconds. Alert fires at or above this value.'));
		o.datatype = 'uinteger';
		o.depends({ type: 'latency' });
		o.placeholder = '250';

		o = s.option(form.Value, 'latency_low', _('Recovery threshold'), _('Milliseconds. Alert clears at or below this value.'));
		o.datatype = 'uinteger';
		o.depends({ type: 'latency' });
		o.placeholder = '150';

		o = s.option(form.Value, 'samples', _('Samples'));
		o.datatype = 'uinteger';
		o.depends({ type: 'latency' });
		o.placeholder = '5';

		o = s.option(form.ListValue, 'direction', _('Direction'));
		o.value('rx', _('Download'));
		o.value('tx', _('Upload'));
		o.value('both', _('Both'));
		o.depends({ type: 'speed_threshold' });
		o.default = 'rx';

		o = s.option(form.ListValue, 'comparator', _('Condition'));
		o.value('below', _('Below threshold'));
		o.value('above', _('Above threshold'));
		o.depends({ type: 'speed_threshold' });
		o.default = 'below';

		o = s.option(form.Value, 'threshold_kbps', _('Speed threshold'), _('Kilobits per second.'));
		o.datatype = 'uinteger';
		o.depends({ type: 'speed_threshold' });
		o.placeholder = '1024';

		o = s.option(form.Value, 'window', _('Measurement window'), _('Seconds used to calculate average speed.'));
		o.datatype = 'uinteger';
		o.depends({ type: 'speed_threshold' });
		o.placeholder = '60';

		o = s.option(form.ListValue, 'status_source', _('SIM status source'), _('Use the Quectel CM LuCI app status backend for modem and SIM state.'));
		o.value('qtcm', _('Quectel CM'));
		o.default = 'qtcm';
		o.depends({ type: 'sim_tampering' });

		o = s.option(form.Value, 'at_port', _('AT command port'), _('Use auto to reuse the AT port detected by luci-app-quectel-cm.'));
		o.depends({ type: 'sim_tampering' });
		o.placeholder = 'auto';

		o = s.option(form.Value, 'gcom_dir', _('gcom script directory'));
		o.datatype = 'directory';
		o.depends({ type: 'sim_tampering' });
		o.placeholder = '/etc/gcom';

		o = s.option(form.Value, 'iccid_script', _('ICCID script'));
		o.depends({ type: 'sim_tampering' });
		o.placeholder = 'iccid.gcom';

		o = s.option(form.Value, 'imsi_script', _('IMSI script'));
		o.depends({ type: 'sim_tampering' });
		o.placeholder = 'imsi.gcom';

		o = s.option(form.Value, 'imei_script', _('IMEI script'));
		o.depends({ type: 'sim_tampering' });
		o.placeholder = 'imei.gcom';

		o = s.option(form.Value, 'expected_iccid', _('Expected ICCID'));
		o.depends({ type: 'sim_tampering' });

		o = s.option(form.Value, 'expected_imsi', _('Expected IMSI'));
		o.depends({ type: 'sim_tampering' });

		o = s.option(form.Value, 'expected_imei', _('Expected IMEI'));
		o.depends({ type: 'sim_tampering' });

		addChannels(s);

		return m.render();
	}
});

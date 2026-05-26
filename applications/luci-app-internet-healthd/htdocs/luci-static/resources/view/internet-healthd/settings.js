'use strict';
'require form';
'require view';

return view.extend({
	render: function() {
		var m, s, o;

		function recoveryOptions(section) {
			var opt;

			opt = section.option(form.Value, 'failure_threshold', _('Failure threshold'));
			opt.datatype = 'uinteger';
			opt.default = '3';

			opt = section.option(form.Flag, 'restart_interface', _('Restart interface'));
			opt.default = '1';

			opt = section.option(form.Flag, 'restart_modem', _('Restart modem'));
			opt.default = '0';

			opt = section.option(form.Flag, 'restart_network', _('Restart network'));
			opt.default = '0';

			opt = section.option(form.Flag, 'reboot_router', _('Reboot router'));
			opt.default = '0';
		}

		m = new form.Map('internet-healthd', _('Internet Health - Settings'));

		s = m.section(form.NamedSection, 'main', 'service', _('Service'));

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';

		o = s.option(form.Value, 'interval', _('Check interval'));
		o.datatype = 'uinteger';
		o.default = '30';
		o.placeholder = '30';

		o = s.option(form.Value, 'timeout', _('Probe timeout'));
		o.datatype = 'uinteger';
		o.default = '3';
		o.placeholder = '3';

		o = s.option(form.ListValue, 'discovery', _('Interface discovery'));
		o.default = 'all';
		o.value('all', _('All network interfaces'));
		o.value('firewall_zone', _('Firewall zone'));
		o.value('list', _('Configured list'));

		o = s.option(form.Value, 'firewall_zone', _('Firewall zone'));
		o.default = 'wan';
		o.placeholder = 'wan';
		o.depends('discovery', 'firewall_zone');

		o = s.option(form.DynamicList, 'interface', _('Interfaces'));
		o.datatype = 'uciname';
		o.placeholder = 'wan';
		o.depends('discovery', 'list');

		o = s.option(form.DynamicList, 'exclude_interface', _('Exclude interfaces'));
		o.datatype = 'uciname';
		o.placeholder = 'loopback';

		o = s.option(form.Flag, 'force_offline_test', _('Force test offline interfaces'));
		o.default = '1';

		o = s.option(form.DynamicList, 'ping_target', _('Ping targets'));
		o.datatype = 'host';
		o.placeholder = '1.1.1.1';

		o = s.option(form.DynamicList, 'dns_target', _('DNS targets'));
		o.datatype = 'hostname';
		o.placeholder = 'openwrt.org';

		o = s.option(form.DynamicList, 'http_url', _('HTTP targets'));
		o.datatype = 'url';
		o.placeholder = 'http://connectivitycheck.gstatic.com/generate_204';

		o = s.option(form.Value, 'status_file', _('Status file'));
		o.default = '/var/run/internet-healthd/status.json';

		o = s.option(form.Value, 'event_log', _('Event log'));
		o.default = '/var/log/internet-healthd.log';

		s = m.section(form.NamedSection, 'defaults', 'recovery', _('Default recovery actions'));
		recoveryOptions(s);

		s = m.section(form.GridSection, 'recovery', _('Per-interface recovery overrides'));
		s.addremove = true;
		s.anonymous = true;
		s.filter = function(section_id) {
			return section_id !== 'defaults';
		};

		o = s.option(form.Value, 'interface', _('Interface'));
		o.datatype = 'uciname';
		o.placeholder = 'wan';

		recoveryOptions(s);

		return m.render();
	}
});

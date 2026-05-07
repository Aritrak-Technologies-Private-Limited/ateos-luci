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
			_('Event Rules'),
			_('Device-local event rules. These events are detected on the router from local logs, hotplug hooks and link state changes.'));

		s = m.section(form.TypedSection, 'event', _('Event Rules'));
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add event rule');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';

		o = s.option(form.ListValue, 'type', _('Event'));
		o.value('ssh_login', _('SSH login'));
		o.value('telnet_login', _('Telnet login'));
		o.value('local_user_login', _('Local user login'));
		o.value('hotplug', _('Hotplug'));
		o.value('ethernet_link', _('Ethernet link'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'severity', _('Severity'));
		o.value('info', _('Info'));
		o.value('warning', _('Warning'));
		o.value('critical', _('Critical'));
		o.default = 'warning';

		o = s.option(form.ListValue, 'source', _('Source'));
		o.value('syslog', _('System log'));
		o.value('hotplug', _('Hotplug'));
		o.value('netlink', _('Network link state'));
		o.default = 'syslog';

		o = s.option(form.ListValue, 'service', _('Service'));
		o.value('dropbear', _('Dropbear SSH'));
		o.value('sshd', _('OpenSSH'));
		o.value('telnet', _('Telnet'));
		o.depends({ type: 'ssh_login' });
		o.depends({ type: 'telnet_login' });

		o = s.option(form.Flag, 'match_success', _('Login success'));
		o.default = '1';
		o.depends({ type: 'ssh_login' });
		o.depends({ type: 'telnet_login' });

		o = s.option(form.Flag, 'match_failure', _('Login failure'));
		o.default = '1';
		o.depends({ type: 'ssh_login' });
		o.depends({ type: 'telnet_login' });

		o = s.option(form.Flag, 'include_root', _('Include root user'));
		o.default = '1';
		o.depends({ type: 'ssh_login' });
		o.depends({ type: 'telnet_login' });
		o.depends({ type: 'local_user_login' });

		o = s.option(form.Flag, 'include_non_root', _('Include non-root users'));
		o.default = '1';
		o.depends({ type: 'ssh_login' });
		o.depends({ type: 'telnet_login' });
		o.depends({ type: 'local_user_login' });

		o = s.option(form.DynamicList, 'subsystem', _('Hotplug subsystem'));
		o.value('iface', _('Interface'));
		o.value('net', _('Network device'));
		o.value('usb', _('USB'));
		o.value('block', _('Block device'));
		o.depends({ type: 'hotplug' });

		o = s.option(widgets.DeviceSelect, 'interface', _('Interface'));
		o.depends({ type: 'ethernet_link' });
		o.placeholder = '*';

		o = s.option(form.Flag, 'match_plugged', _('Plugged in'));
		o.default = '1';
		o.depends({ type: 'ethernet_link' });

		o = s.option(form.Flag, 'match_unplugged', _('Unplugged'));
		o.default = '1';
		o.depends({ type: 'ethernet_link' });

		addChannels(s);

		return m.render();
	}
});

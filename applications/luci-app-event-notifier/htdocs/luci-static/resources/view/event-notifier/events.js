'use strict';
'require view';
'require form';

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
		o.value('login', _('Login'));
		o.value('hotplug', _('Hotplug'));
		o.value('netifd_interface', _('Interface state'));
		o.value('ethernet_link', _('Ethernet link'));
		o.value('luci_login', _('LuCI login'));
		o.value('firewall_security', _('Firewall / security'));
		o.value('service_health', _('Service health'));
		o.value('dhcp_lease', _('DHCP lease'));
		o.value('vpn_state', _('VPN state'));
		o.value('sim_service', _('SIM service'));
		o.value('dns_network', _('DNS / network'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'severity', _('Severity'));
		o.value('info', _('Info'));
		o.value('warning', _('Warning'));
		o.value('critical', _('Critical'));
		o.default = 'warning';

		o = s.option(form.ListValue, 'source', _('Source'));
		o.value('syslog', _('System log'));
		o.value('hotplug', _('Hotplug'));
		o.value('netifd', _('netifd'));
		o.value('netlink', _('Network link state'));
		o.default = 'syslog';

		o = s.option(form.MultiValue, 'login_method', _('Login methods'));
		o.value('ssh', _('SSH'));
		o.value('telnet', _('Telnet'));
		o.value('local_user', _('Local user'));
		o.default = ['ssh', 'telnet', 'local_user'];
		o.depends({ type: 'login' });

		o = s.option(form.Flag, 'match_success', _('Login success'));
		o.default = '1';
		o.depends({ type: 'login' });

		o = s.option(form.Flag, 'match_failure', _('Login failure'));
		o.default = '1';
		o.depends({ type: 'login' });

		o = s.option(form.Flag, 'include_root', _('Include root user'));
		o.default = '1';
		o.depends({ type: 'login' });

		o = s.option(form.Flag, 'include_non_root', _('Include non-root users'));
		o.default = '1';
		o.depends({ type: 'login' });

		o = s.option(form.DynamicList, 'subsystem', _('Hotplug subsystem'));
		o.value('iface', _('Interface'));
		o.value('net', _('Network device'));
		o.value('usb', _('USB'));
		o.value('block', _('Block device'));
		o.depends({ type: 'hotplug' });

		o = s.option(form.DynamicList, 'interface', _('Interfaces'), _('Use physical device names or logical network names. Use * to match all interfaces.'));
		o.depends({ type: 'netifd_interface' });
		o.depends({ type: 'ethernet_link' });
		o.depends({ type: 'dhcp_lease' });
		o.value('*', _('All Ethernet interfaces'));
		o.value('eth0', 'eth0');
		o.value('eth1', 'eth1');
		o.value('wan', 'wan');
		o.value('wan2', 'wan2');
		o.value('lan', 'lan');
		o.placeholder = '*';

		o = s.option(form.MultiValue, 'state', _('Interface states'));
		o.value('up', _('Up'));
		o.value('down', _('Down'));
		o.value('ifup', _('ifup'));
		o.value('ifdown', _('ifdown'));
		o.default = ['up', 'down'];
		o.depends({ type: 'netifd_interface' });

		o = s.option(form.Flag, 'match_plugged', _('Plugged in'));
		o.default = '1';
		o.depends({ type: 'ethernet_link' });

		o = s.option(form.Flag, 'match_unplugged', _('Unplugged'));
		o.default = '1';
		o.depends({ type: 'ethernet_link' });

		o = s.option(form.DynamicList, 'category', _('Categories'));
		o.value('firewall', _('Firewall'));
		o.value('banip', _('banIP'));
		o.value('drop', _('Packet drop'));
		o.value('dns', _('DNS'));
		o.value('resolver', _('Resolver'));
		o.value('network', _('Network'));
		o.depends({ type: 'firewall_security' });
		o.depends({ type: 'dns_network' });

		o = s.option(form.DynamicList, 'service', _('Services'));
		o.value('qconnect', 'qconnect');
		o.value('qtcm', 'qtcm');
		o.value('network', 'network');
		o.value('dnsmasq', 'dnsmasq');
		o.value('dropbear', 'dropbear');
		o.depends({ type: 'service_health' });
		o.depends({ type: 'sim_service' });

		o = s.option(form.DynamicList, 'vpn', _('VPN types'));
		o.value('wireguard', _('WireGuard'));
		o.value('openvpn', _('OpenVPN'));
		o.value('ipsec', _('IPsec'));
		o.value('tailscale', _('Tailscale'));
		o.depends({ type: 'vpn_state' });

		o = s.option(form.Flag, 'match_add', _('Added'));
		o.default = '1';
		o.depends({ type: 'dhcp_lease' });

		o = s.option(form.Flag, 'match_remove', _('Removed'));
		o.default = '1';
		o.depends({ type: 'dhcp_lease' });

		o = s.option(form.Flag, 'match_up', _('Up'));
		o.default = '1';
		o.depends({ type: 'vpn_state' });

		o = s.option(form.Flag, 'match_down', _('Down'));
		o.default = '1';
		o.depends({ type: 'vpn_state' });

		o = s.option(form.Flag, 'match_restart', _('Restart'));
		o.default = '1';
		o.depends({ type: 'service_health' });
		o.depends({ type: 'sim_service' });

		o = s.option(form.Flag, 'match_crash', _('Crash'));
		o.default = '1';
		o.depends({ type: 'service_health' });

		o = s.option(form.Flag, 'match_error', _('Error'));
		o.default = '1';
		o.depends({ type: 'service_health' });
		o.depends({ type: 'sim_service' });

		o = s.option(form.Flag, 'match_recovery', _('Recovery'));
		o.default = '1';
		o.depends({ type: 'dns_network' });

		addChannels(s);

		return m.render();
	}
});

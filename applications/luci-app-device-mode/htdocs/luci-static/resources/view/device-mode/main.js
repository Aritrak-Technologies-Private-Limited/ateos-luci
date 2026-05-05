'use strict';
'require fs';
'require form';
'require network';
'require ui';
'require uci';
'require view';

function modeLabel(mode) {
	var labels = {
		router: _('Router Mode'),
		wireless_client: _('Wireless Client Mode'),
		wifi_repeater: _('WiFi Repeater'),
		dumb_lan: _('Dumb LAN Mode')
	};

	return labels[mode] || mode || _('Unknown');
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('device_mode'),
			network.getWifiDevices(),
			network.getDevices()
		]);
	},

	render: function(data) {
		var wifiDevices = data[1] || [],
		    netDevices = data[2] || [],
		    currentMode = uci.get('device_mode', 'main', 'mode') || 'router',
		    m, s, o;

		m = new form.Map('device_mode', _('Operating Mode'),
			_('Switch the device between router, wireless client, WiFi repeater, and unmanaged LAN switch profiles.'));

		s = m.section(form.NamedSection, 'main', 'config', _('Mode Selection'),
			_('Changing mode rewrites network, wireless, DHCP, and firewall settings. A backup is created under /etc/backup/device-mode before each apply.'));

		o = s.option(form.DummyValue, '_active', _('Current saved mode'));
		o.cfgvalue = function() {
			return modeLabel(currentMode);
		};

		o = s.option(form.ListValue, 'mode', _('Operating mode'));
		o.default = 'router';
		o.rmempty = false;
		o.value('router', _('Router Mode'));
		o.value('wireless_client', _('Wireless Client Mode'));
		o.value('wifi_repeater', _('WiFi Repeater'));
		o.value('dumb_lan', _('Dumb LAN Mode'));

		o = s.option(form.Value, 'lan_ipaddr', _('LAN IP address'));
		o.default = '192.168.1.1';
		o.datatype = 'ip4addr';
		o.rmempty = false;
		o.depends('mode', 'router');
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');
		o.depends({ mode: 'dumb_lan', dumb_lan_proto: 'static' });

		o = s.option(form.Value, 'lan_netmask', _('LAN netmask'));
		o.default = '255.255.255.0';
		o.datatype = 'ip4addr';
		o.rmempty = false;
		o.depends('mode', 'router');
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');
		o.depends({ mode: 'dumb_lan', dumb_lan_proto: 'static' });

		o = s.option(form.ListValue, 'dumb_lan_proto', _('Dumb LAN management address'));
		o.default = 'static';
		o.value('static', _('Use static LAN IP'));
		o.value('dhcp', _('Get address from upstream DHCP'));
		o.depends('mode', 'dumb_lan');

		o = s.option(form.Value, 'lan_ifname', _('LAN device'));
		o.placeholder = 'lan';
		o.rmempty = true;
		netDevices.forEach(function(dev) {
			var name = dev.getName();
			if (name)
				o.value(name);
		});

		o = s.option(form.Value, 'wan_ifname', _('WAN device'));
		o.placeholder = 'wan';
		o.rmempty = true;
		netDevices.forEach(function(dev) {
			var name = dev.getName();
			if (name)
				o.value(name);
		});
		o.depends('mode', 'router');

		o = s.option(form.ListValue, 'wifi_radio', _('Wireless radio'));
		o.rmempty = true;
		o.value('', _('Auto'));
		wifiDevices.forEach(function(radio) {
			o.value(radio.getName(), radio.getName());
		});
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');
		o.depends('mode', 'router');

		o = s.option(form.Value, 'uplink_ssid', _('Uplink SSID'));
		o.rmempty = false;
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');

		o = s.option(form.ListValue, 'uplink_encryption', _('Uplink encryption'));
		o.default = 'psk2';
		o.value('psk2', _('WPA2-PSK'));
		o.value('psk-mixed', _('WPA/WPA2-PSK mixed'));
		o.value('sae', _('WPA3-SAE'));
		o.value('none', _('No encryption'));
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');

		o = s.option(form.Value, 'uplink_key', _('Uplink password'));
		o.password = true;
		o.rmempty = true;
		o.depends({ mode: 'wireless_client', uplink_encryption: 'psk2' });
		o.depends({ mode: 'wireless_client', uplink_encryption: 'psk-mixed' });
		o.depends({ mode: 'wireless_client', uplink_encryption: 'sae' });
		o.depends({ mode: 'wifi_repeater', uplink_encryption: 'psk2' });
		o.depends({ mode: 'wifi_repeater', uplink_encryption: 'psk-mixed' });
		o.depends({ mode: 'wifi_repeater', uplink_encryption: 'sae' });

		o = s.option(form.Value, 'ap_ssid', _('Local WiFi SSID'));
		o.default = 'OpenWrt';
		o.rmempty = false;
		o.depends('mode', 'router');
		o.depends('mode', 'wifi_repeater');

		o = s.option(form.ListValue, 'ap_encryption', _('Local WiFi encryption'));
		o.default = 'none';
		o.value('none', _('No encryption'));
		o.value('psk2', _('WPA2-PSK'));
		o.value('psk-mixed', _('WPA/WPA2-PSK mixed'));
		o.value('sae', _('WPA3-SAE'));
		o.depends('mode', 'router');
		o.depends('mode', 'wifi_repeater');

		o = s.option(form.Value, 'ap_key', _('Local WiFi password'));
		o.password = true;
		o.rmempty = true;
		o.depends({ mode: 'router', ap_encryption: 'psk2' });
		o.depends({ mode: 'router', ap_encryption: 'psk-mixed' });
		o.depends({ mode: 'router', ap_encryption: 'sae' });
		o.depends({ mode: 'wifi_repeater', ap_encryption: 'psk2' });
		o.depends({ mode: 'wifi_repeater', ap_encryption: 'psk-mixed' });
		o.depends({ mode: 'wifi_repeater', ap_encryption: 'sae' });

		o = s.option(form.Button, '_apply_mode', _('Apply operating mode'));
		o.inputstyle = 'apply';
		o.inputtitle = _('Save & Apply Mode');
		o.onclick = function() {
			return m.save().then(function() {
				return fs.exec('/usr/libexec/luci-device-mode', [ 'apply' ]);
			}).then(function(res) {
				if (res.code !== 0)
					throw new Error(res.stderr || res.stdout || _('Failed to apply operating mode.'));

				ui.addNotification(null, E('p', res.stdout || _('Operating mode applied. Network services are restarting.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', e.message), 'danger');
			});
		};

		return m.render();
	}
});

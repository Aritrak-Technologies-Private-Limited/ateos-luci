'use strict';
'require fs';
'require form';
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

function deviceModeValue(option) {
	var value = uci.get('device_mode', 'main', option);
	return (value != null && value !== '') ? value : null;
}

function bandLabel(band) {
	var labels = {
		'2g': _('2.4 GHz'),
		'5g': _('5 GHz'),
		'6g': _('6 GHz'),
		'60g': _('60 GHz')
	};

	return labels[band] || _('unknown band');
}

function parseRadioInfo(res) {
	var radios = {};

	((res && res.stdout) || '').trim().split(/\n/).forEach(function(line) {
		var fields = line.split(/\t/),
		    name = fields[0];

		if (!name)
			return;

		radios[name] = {
			band: fields[1] || 'unknown',
			phy: fields[2] || ''
		};
	});

	return radios;
}

function parseLineList(res) {
	var values = [];

	((res && res.stdout) || '').trim().split(/\n/).forEach(function(line) {
		line = line.trim();

		if (line)
			values.push(line);
	});

	return values;
}

function radioLabel(name, radios) {
	var info = radios[name],
	    parts = [];

	if (!info)
		return name;

	if (info.band)
		parts.push(bandLabel(info.band));

	if (info.phy)
		parts.push(info.phy);

	return parts.length ? '%s (%s)'.format(name, parts.join(', ')) : name;
}

function firstWifiIface(match) {
	var sections = uci.sections('wireless', 'wifi-iface');

	for (var i = 0; i < sections.length; i++) {
		if (sections[i]['.name'] == 'luci_device_mode_sta' || sections[i]['.name'] == 'luci_device_mode_ap')
			continue;

		if (!match || match(sections[i]))
			return sections[i];
	}

	return null;
}

function firstNetworkDevice(names) {
	for (var i = 0; i < names.length; i++) {
		var name = names[i];

		if (uci.get('network', name, 'device'))
			return uci.get('network', name, 'device');

		if (uci.get('network', name, 'ifname'))
			return uci.get('network', name, 'ifname');
	}

	return null;
}

return view.extend({
	load: function() {
		return fs.exec('/usr/libexec/luci-device-mode', [ 'init' ]).then(function() {
			uci.unload('device_mode');

			return Promise.all([
				uci.load('device_mode'),
				uci.load('network'),
				uci.load('wireless').catch(function() { return null; }),
				fs.exec('/usr/libexec/luci-device-mode', [ 'radios' ]).catch(function() { return null; }),
				fs.exec('/usr/libexec/luci-device-mode', [ 'netdevs' ]).catch(function() { return null; })
			]);
		});
	},

	render: function(data) {
		var radioInfo = parseRadioInfo(data[3]),
		    radioNames = Object.keys(radioInfo),
		    netDevices = parseLineList(data[4]),
		    currentMode = uci.get('device_mode', 'main', 'mode') || 'router',
		    currentAp = firstWifiIface(function(s) { return s.mode == 'ap' && L.toArray(s.network).indexOf('lan') > -1; }),
		    currentSta = firstWifiIface(function(s) { return s.mode == 'sta'; }),
		    defaultLanDevice = firstNetworkDevice([ 'lan' ]) || 'lan',
		    defaultWanDevice = firstNetworkDevice([ 'wan', 'wan6' ]) || 'wan',
		    defaultRadio = deviceModeValue('wifi_radio') || (currentAp && currentAp.device) || (currentSta && currentSta.device) || '',
		    m, s, o;

		function fallback(option, value) {
			return deviceModeValue(option) || value || '';
		}

		m = new form.Map('device_mode', _('Operating Mode'),
			_('Switch the device between router, wireless client, WiFi repeater, and unmanaged LAN switch profiles.'));

		s = m.section(form.NamedSection, 'main', 'config', _('Mode Selection'),
			_('Changing mode rewrites network, wireless, DHCP, and firewall settings. A backup is created under /etc/backup/device-mode before each apply.'));

		s.tab('mode', _('Mode'));
		s.tab('advanced', _('Advanced'));

		o = s.taboption('mode', form.DummyValue, '_active', _('Current saved mode'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('span', {
				'class': 'ifacebadge',
				'style': 'display:inline-flex;align-items:center;min-height:2.4em'
			}, [ modeLabel(currentMode) ]).outerHTML;
		};

		o = s.taboption('mode', form.ListValue, 'mode', _('Operating mode'));
		o.default = 'router';
		o.rmempty = false;
		o.value('router', _('Router Mode'));
		o.value('wireless_client', _('Wireless Client Mode'));
		o.value('wifi_repeater', _('WiFi Repeater'));
		o.value('dumb_lan', _('Dumb LAN Mode'));

		o = s.taboption('advanced', form.Value, 'lan_ipaddr', _('LAN IP address'));
		o.default = '192.168.1.1';
		o.cfgvalue = function() {
			return fallback('lan_ipaddr', uci.get('network', 'lan', 'ipaddr') || '192.168.1.1');
		};
		o.datatype = 'ip4addr';
		o.rmempty = false;
		o.depends('mode', 'router');
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');
		o.depends({ mode: 'dumb_lan', dumb_lan_proto: 'static' });

		o = s.taboption('advanced', form.Value, 'lan_netmask', _('LAN netmask'));
		o.default = '255.255.255.0';
		o.cfgvalue = function() {
			return fallback('lan_netmask', uci.get('network', 'lan', 'netmask') || '255.255.255.0');
		};
		o.datatype = 'ip4addr';
		o.rmempty = false;
		o.depends('mode', 'router');
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');
		o.depends({ mode: 'dumb_lan', dumb_lan_proto: 'static' });

		o = s.taboption('advanced', form.ListValue, 'dumb_lan_proto', _('Dumb LAN management address'));
		o.default = 'static';
		o.value('static', _('Use static LAN IP'));
		o.value('dhcp', _('Get address from upstream DHCP'));
		o.depends('mode', 'dumb_lan');

		o = s.taboption('advanced', form.Value, 'lan_ifname', _('LAN device'));
		o.placeholder = 'lan';
		o.cfgvalue = function() {
			return fallback('lan_ifname', defaultLanDevice);
		};
		o.rmempty = true;
		netDevices.forEach(function(name) {
			o.value(name);
		});

		o = s.taboption('advanced', form.Value, 'wan_ifname', _('WAN device'));
		o.placeholder = 'wan';
		o.cfgvalue = function() {
			return fallback('wan_ifname', defaultWanDevice);
		};
		o.rmempty = true;
		netDevices.forEach(function(name) {
			o.value(name);
		});
		o.depends('mode', 'router');

		o = s.taboption('advanced', form.ListValue, 'wifi_radio', _('Wireless radio'));
		o.rmempty = true;
		o.cfgvalue = function() {
			return defaultRadio;
		};
		o.value('', _('Auto'));
		radioNames.forEach(function(name) {
			o.value(name, radioLabel(name, radioInfo));
		});
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');
		o.depends('mode', 'router');

		o = s.taboption('mode', form.Value, 'uplink_ssid', _('Uplink SSID'));
		o.cfgvalue = function() {
			return fallback('uplink_ssid', currentSta ? currentSta.ssid : '');
		};
		o.rmempty = false;
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');

		o = s.taboption('mode', form.ListValue, 'uplink_encryption', _('Uplink encryption'));
		o.default = 'psk2';
		o.cfgvalue = function() {
			return fallback('uplink_encryption', currentSta ? currentSta.encryption : 'psk2');
		};
		o.value('psk2', _('WPA2-PSK'));
		o.value('psk-mixed', _('WPA/WPA2-PSK mixed'));
		o.value('sae', _('WPA3-SAE'));
		o.value('none', _('No encryption'));
		o.depends('mode', 'wireless_client');
		o.depends('mode', 'wifi_repeater');

		o = s.taboption('mode', form.Value, 'uplink_key', _('Uplink password'));
		o.password = true;
		o.cfgvalue = function() {
			return fallback('uplink_key', currentSta ? currentSta.key : '');
		};
		o.rmempty = true;
		o.depends({ mode: 'wireless_client', uplink_encryption: 'psk2' });
		o.depends({ mode: 'wireless_client', uplink_encryption: 'psk-mixed' });
		o.depends({ mode: 'wireless_client', uplink_encryption: 'sae' });
		o.depends({ mode: 'wifi_repeater', uplink_encryption: 'psk2' });
		o.depends({ mode: 'wifi_repeater', uplink_encryption: 'psk-mixed' });
		o.depends({ mode: 'wifi_repeater', uplink_encryption: 'sae' });

		o = s.taboption('mode', form.Value, 'ap_ssid', _('Local WiFi SSID'));
		o.default = 'OpenWrt';
		o.cfgvalue = function() {
			return fallback('ap_ssid', currentAp ? currentAp.ssid : 'OpenWrt');
		};
		o.rmempty = false;
		o.depends('mode', 'router');
		o.depends('mode', 'wifi_repeater');

		o = s.taboption('mode', form.ListValue, 'ap_encryption', _('Local WiFi encryption'));
		o.default = 'none';
		o.cfgvalue = function() {
			return fallback('ap_encryption', currentAp ? currentAp.encryption : 'none');
		};
		o.value('none', _('No encryption'));
		o.value('psk2', _('WPA2-PSK'));
		o.value('psk-mixed', _('WPA/WPA2-PSK mixed'));
		o.value('sae', _('WPA3-SAE'));
		o.depends('mode', 'router');
		o.depends('mode', 'wifi_repeater');

		o = s.taboption('mode', form.Value, 'ap_key', _('Local WiFi password'));
		o.password = true;
		o.cfgvalue = function() {
			return fallback('ap_key', currentAp ? currentAp.key : '');
		};
		o.rmempty = true;
		o.depends({ mode: 'router', ap_encryption: 'psk2' });
		o.depends({ mode: 'router', ap_encryption: 'psk-mixed' });
		o.depends({ mode: 'router', ap_encryption: 'sae' });
		o.depends({ mode: 'wifi_repeater', ap_encryption: 'psk2' });
		o.depends({ mode: 'wifi_repeater', ap_encryption: 'psk-mixed' });
		o.depends({ mode: 'wifi_repeater', ap_encryption: 'sae' });

		o = s.taboption('mode', form.Button, '_apply_mode', _('Apply operating mode'));
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

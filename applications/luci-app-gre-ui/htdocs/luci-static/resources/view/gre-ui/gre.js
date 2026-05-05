'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require form';
'require network';

function getGRESections() {
	return uci.sections('network', 'interface').filter(function(s) {
		return s.proto == 'gre';
	}).map(function(s) {
		return s['.name'];
	});
}

function tunnelCommand(section_id, command) {
	return fs.exec(command, [ section_id ]).then(function() {
		return network.flushCache();
	}).catch(function(e) {
		ui.addNotification(null, E('p', e.message), 'danger');
		throw e;
	});
}

function firstValue(section_id, option) {
	return uci.get('network', section_id, option) || E('em', _('not set'));
}

function isNetmask(value) {
	var parts = value.split('.'),
	    bits = '',
	    seenZero = false;

	if (parts.length != 4)
		return false;

	for (var i = 0; i < parts.length; i++) {
		var n = +parts[i];

		if (!parts[i].match(/^\d+$/) || n < 0 || n > 255)
			return false;

		bits += ('00000000' + n.toString(2)).slice(-8);
	}

	for (var j = 0; j < bits.length; j++) {
		if (bits.charAt(j) == '0')
			seenZero = true;
		else if (seenZero)
			return false;
	}

	return true;
}

function validateNetmask(section_id, value) {
	if (value == null || value == '')
		return true;

	return isNetmask(value) || _('Expecting a valid IPv4 subnet mask');
}

function addEnabledOption(section) {
	var o = section.taboption('general', form.Flag, '_enabled', _('Status'));

	o.enabled = '1';
	o.disabled = '0';
	o.default = '1';
	o.rmempty = false;
	o.cfgvalue = function(section_id) {
		return uci.get('network', section_id, 'disabled') == '1' ? '0' : '1';
	};
	o.write = function(section_id, value) {
		if (value == '1')
			uci.unset('network', section_id, 'disabled');
		else
			uci.set('network', section_id, 'disabled', '1');
	};

	return o;
}

function addGREOptions(section) {
	var o;

	o = section.taboption('general', form.Value, 'ipaddr', _('Local IP Address'));
	o.datatype = 'ip4addr("nomask")';
	o.optional = true;

	o = section.taboption('general', form.Value, 'peeraddr', _('Remote IP Address'));
	o.datatype = 'or(hostname,ip4addr("nomask"))';
	o.rmempty = false;

	o = section.taboption('general', form.Value, 'ttl', _('TTL'));
	o.datatype = 'range(1,255)';
	o.placeholder = '64';
	o.optional = true;

	o = section.taboption('route', form.Value, 'static_ipaddr', _('Static IP Address'));
	o.datatype = 'ip4addr("nomask")';
	o.optional = true;

	o = section.taboption('route', form.Value, 'static_netmask', _('Static Subnet Mask'));
	o.datatype = 'ip4addr("nomask")';
	o.placeholder = '255.255.255.0';
	o.optional = true;
	o.validate = validateNetmask;

	o = section.taboption('route', form.Value, 'tunnel_target', _('Tunnel Target'));
	o.datatype = 'ip4addr("nomask")';
	o.optional = true;

	o = section.taboption('route', form.Value, 'tunnel_netmask', _('Tunnel Subnet Mask'));
	o.datatype = 'ip4addr("nomask")';
	o.placeholder = '255.255.255.0';
	o.optional = true;
	o.validate = validateNetmask;

	o = section.taboption('route', form.Value, 'tunnel_gateway', _('Tunnel Gateway'));
	o.datatype = 'ip4addr("nomask")';
	o.optional = true;
}

return view.extend({
	load: function() {
		return Promise.all([
			L.require('protocol.gre'),
			uci.load('network'),
			network.flushCache()
		]);
	},

	render: function() {
		var m, s, o;

		m = new form.Map('network', _('GRE'));

		s = m.section(form.GridSection, 'interface', _('GRE Tunnels (Max: 10)'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add tunnel');
		s.nodescriptions = true;
		s.cfgsections = getGRESections;

		s.handleAdd = function(ev) {
			var m2 = new form.Map('network'),
			    s2 = m2.section(form.NamedSection, '_new_'),
			    name;

			if (getGRESections().length >= 10) {
				ui.addNotification(null, E('p', _('Maximum of 10 GRE tunnels reached.')), 'warning');
				return;
			}

			s2.render = function() {
				return Promise.all([
					{},
					this.renderUCISection('_new_')
				]).then(this.renderContents.bind(this));
			};

			name = s2.option(form.Value, 'name', _('Tunnel Name'));
			name.rmempty = false;
			name.datatype = 'uciname';
			name.placeholder = 'gre0';
			name.validate = function(section_id, value) {
				if (uci.get('network', value) != null)
					return _('The interface name is already used');

				if (value.length > 15)
					return _('The interface name is too long');

				return true;
			};

			return m2.render().then(L.bind(function(nodes) {
				ui.showModal(_('Add GRE tunnel'), [
					nodes,
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Cancel')), ' ',
						E('button', {
							'class': 'cbi-button cbi-button-positive important',
							'click': ui.createHandlerFn(this, function(ev) {
								var nameval = name.isValid('_new_') ? name.formvalue('_new_') : null;

								if (nameval == null || nameval == '')
									return;

								return this.map.save(function() {
									uci.add('network', 'interface', nameval);
									uci.set('network', nameval, 'proto', 'gre');
									uci.set('network', nameval, 'auto', '1');

									s.addedSection = nameval;
								}).then(L.bind(function() {
									ui.hideModal();
									return this.map.load();
								}, this)).then(L.bind(function() {
									return this.renderMoreOptionsModal(this.addedSection);
								}, this));
							})
						}, _('Create tunnel'))
					])
				], 'cbi-modal');

				nodes.querySelector('[id="%s"] input[type="text"]'.format(name.cbid('_new_'))).focus();
			}, this));
		};

		s.renderSectionPlaceholder = function() {
			return E('em', _('No GRE tunnels configured.'));
		};

		s.modaltitle = function(section_id) {
			return _('GRE') + ' » ' + section_id;
		};

		s.addModalOptions = function(ss) {
			var o;

			ss.tab('general', _('General Settings'));
			ss.tab('route', _('Route Settings'));

			o = ss.taboption('general', form.Value, '_name', _('Tunnel'));
			o.modalonly = true;
			o.readonly = true;
			o.cfgvalue = function(section_id) {
				return section_id;
			};
			o.write = function() {};

			addEnabledOption(ss);
			addGREOptions(ss);
		};

		o = s.option(form.DummyValue, '_tunnel', _('#'));
		o.textvalue = function(section_id) {
			return section_id;
		};

		o = s.option(form.DummyValue, '_status', _('Status'));
		o.textvalue = function(section_id) {
			return uci.get('network', section_id, 'disabled') == '1'
				? E('span', { 'class': 'ifacebadge' }, _('Disabled'))
				: E('span', { 'class': 'ifacebadge' }, _('Enabled'));
		};

		o = s.option(form.DummyValue, '_local', _('Local IP Address'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'ipaddr');
		};

		o = s.option(form.DummyValue, '_remote', _('Remote IP Address'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'peeraddr');
		};

		o = s.option(form.DummyValue, '_ttl', _('TTL'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'ttl');
		};

		o = s.option(form.DummyValue, '_static_ipaddr', _('Static IP Address'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'static_ipaddr');
		};

		o = s.option(form.DummyValue, '_static_netmask', _('Static Subnet Mask'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'static_netmask');
		};

		o = s.option(form.DummyValue, '_tunnel_target', _('Tunnel Target'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'tunnel_target');
		};

		o = s.option(form.DummyValue, '_tunnel_netmask', _('Tunnel Subnet Mask'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'tunnel_netmask');
		};

		o = s.option(form.DummyValue, '_tunnel_gateway', _('Tunnel Gateway'));
		o.textvalue = function(section_id) {
			return firstValue(section_id, 'tunnel_gateway');
		};

		o = s.option(form.Button, '_restart', _('Restart Tunnel'));
		o.inputtitle = _('Restart');
		o.inputstyle = 'apply';
		o.onclick = function(ev, section_id) {
			return tunnelCommand(section_id, '/sbin/ifdown').then(function() {
				return tunnelCommand(section_id, '/sbin/ifup');
			}).then(function() {
				ui.addNotification(null, E('p', _('GRE tunnel "%h" restarted.').format(section_id)), 'info');
			});
		};

		return m.render();
	}
});

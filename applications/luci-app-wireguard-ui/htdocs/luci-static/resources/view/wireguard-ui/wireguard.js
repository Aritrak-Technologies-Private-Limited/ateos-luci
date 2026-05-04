'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require form';
'require network';

function getWireGuardSections() {
	return uci.sections('network', 'interface').filter(function(s) {
		return s.proto == 'wireguard';
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

return view.extend({
	load: function() {
		return Promise.all([
			L.require('protocol.wireguard'),
			uci.load('network'),
			network.flushCache()
		]);
	},

	render: function() {
		var m, s, o;

		m = new form.Map('network', _('WireGuard'));

		s = m.section(form.GridSection, 'interface', _('Tunnels'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add tunnel');
		s.nodescriptions = true;

		s.cfgsections = getWireGuardSections;

		s.handleAdd = function(ev) {
			var m2 = new form.Map('network'),
			    s2 = m2.section(form.NamedSection, '_new_'),
			    name;

			s2.render = function() {
				return Promise.all([
					{},
					this.renderUCISection('_new_')
				]).then(this.renderContents.bind(this));
			};

			name = s2.option(form.Value, 'name', _('Tunnel Name'));
			name.rmempty = false;
			name.datatype = 'uciname';
			name.placeholder = 'wg0';
			name.validate = function(section_id, value) {
				if (uci.get('network', value) != null)
					return _('The interface name is already used');

				if (value.length > 15)
					return _('The interface name is too long');

				return true;
			};

			return m2.render().then(L.bind(function(nodes) {
				ui.showModal(_('Add tunnel'), [
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
									uci.set('network', nameval, 'proto', 'wireguard');
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
			return E('em', _('No WireGuard tunnels configured.'));
		};

		s.modaltitle = function(section_id) {
			return _('WireGuard') + ' » ' + section_id;
		};

		s.addModalOptions = function(ss) {
			var proto = network.getProtocol('wireguard', ss.section),
			    o;

			ss.tab('general', _('General Settings'));
			ss.tab('advanced', _('Advanced Settings'));

			o = ss.taboption('general', form.Value, '_name', _('Tunnel Name'));
			o.modalonly = true;
			o.readonly = true;
			o.cfgvalue = function(section_id) {
				return section_id;
			};
			o.write = function() {};

			o = ss.taboption('general', form.Flag, 'disabled', _('Disabled'));
			o.modalonly = true;

			if (proto != null)
				proto.renderFormOptions(ss);
		};

		s.handleRemove = function(section_id, ev) {
			uci.sections('network', 'wireguard_%s'.format(section_id), function(peer) {
				uci.remove('network', peer['.name']);
			});

			return form.GridSection.prototype.handleRemove.apply(this, arguments);
		};

		o = s.option(form.DummyValue, '_tunnel', _('Tunnel'));
		o.textvalue = function(section_id) {
			var disabled = uci.get('network', section_id, 'disabled') == '1',
			    addresses = L.toArray(uci.get('network', section_id, 'addresses'));

			return E([], [
				E('strong', [ section_id ]),
				' ',
				disabled ? E('span', { 'class': 'ifacebadge' }, _('Disabled')) : E('span', { 'class': 'ifacebadge' }, _('Enabled')),
				E('br'),
				addresses.length ? E('small', [ addresses.join(', ') ]) : E('small', E('em', _('No IP address configured')))
			]);
		};

		o = s.option(form.DummyValue, '_peers', _('Peers'));
		o.textvalue = function(section_id) {
			var count = uci.sections('network', 'wireguard_%s'.format(section_id)).length;
			return count || E('em', _('none'));
		};

		o = s.option(form.Button, '_restart', _('Restart Tunnel'));
		o.inputtitle = _('Restart');
		o.inputstyle = 'apply';
		o.onclick = function(ev, section_id) {
			return tunnelCommand(section_id, '/sbin/ifdown').then(function() {
				return tunnelCommand(section_id, '/sbin/ifup');
			}).then(function() {
				ui.addNotification(null, E('p', _('WireGuard tunnel "%h" restarted.').format(section_id)), 'info');
			});
		};

		o = s.option(form.Button, '_status', _('Status'));
		o.inputtitle = _('Show Status');
		o.inputstyle = 'action';
		o.onclick = function() {
			location.href = L.url('admin/vpn/wireguard/status');
		};

		return m.render();
	}
});

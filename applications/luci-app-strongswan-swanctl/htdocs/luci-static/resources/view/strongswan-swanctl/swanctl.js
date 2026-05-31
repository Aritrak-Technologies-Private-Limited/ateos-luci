'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';
'require tools.widgets as widgets';
'require strongswan_algorithms';

function validateTimeFormat(section_id, value) {
	if (value && !value.match(/^\d+[smhd]$/)) {
		return _('Number must have suffix s, m, h or d');
	}

	return true;
}

function addAlgorithms(o, algorithms) {
	algorithms.forEach(function (algorithm) {
		if (strongswan_algorithms.isInsecure(algorithm)) {
			o.value(algorithm, '%s*'.format(algorithm));
		} else {
			o.value(algorithm);
		}
	});
}

function sectionNameCheck(extra_class) {
	var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
		nameEl = el.querySelector('.cbi-section-create-name');
	ui.addValidator(nameEl, 'uciname', true, function(v) {
		let sections = [
			...uci.sections('ipsec', 'remote'),
			...uci.sections('ipsec', 'tunnel'),
			...uci.sections('ipsec', 'crypto_proposal'),
		];
		if (sections.find(function(s) {
			return s['.name'] == v;
		})) {
			return _('Remotes, Encryption Proposals and Tunnels may not share the same names.') + ' ' + 
				_('Use combinations like tunnel1_phase1 that do not exceed 15 characters.');
		}
		if (v.length > 15) return _('Name length shall not exceed 15 characters');
		return true;
	}, 'blur', 'keyup');
	return el;
};

return view.extend({
	load: function () {
		return uci.load('network');
	},

	render: function () {
		let m, s, o;

		m = new form.Map('ipsec', _('strongSwan Configuration'),
			_('Configure strongSwan for secure VPN connections.'));
		m.tabbed = true;

		// strongSwan General Settings
		s = m.section(form.TypedSection, 'ipsec', _('General Settings'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(widgets.ZoneSelect, 'zone', _('Zone'),
			_('Firewall zone that has to match the defined firewall zone'));
		o.default = 'lan';
		o.multiple = true;

		o = s.option(widgets.NetworkSelect, 'listen', _('Listening Interfaces'),
			_('Interfaces that accept VPN traffic'));
		o.datatype = 'interface';
		o.placeholder = _('Select an interface or leave empty for all interfaces');
		o.default = 'wan';
		o.multiple = true;
		o.rmempty = false;

		o = s.option(form.Value, 'debug', _('Debug Level'),
			_('Trace level: 0 is least verbose, 4 is most'));
		o.default = '0';
		o.datatype = 'range(0,4)';

		// Remote Configuration
		s = m.section(form.GridSection, 'remote', _('Remote Configuration'),
			_('Define Remote IKE Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck

		o = s.tab('general', _('General'));
		o = s.tab('authentication', _('Authentication'));
		o = s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enabled'),
			_('Configuration is enabled or not'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'gateway', _('Gateway (Remote Endpoint)'),
			_('IP address or FQDN name of the tunnel remote endpoint'));
		o.datatype = 'or(hostname,ipaddr)';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'local_gateway', _('Local Gateway'),
			_('IP address or FQDN of the tunnel local endpoint'));
		o.datatype = 'or(hostname,ipaddr)';
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'local_sourceip', _('Local Source IP'),
			_('Virtual IP(s) to request in IKEv2 configuration payloads requests'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'local_ip', _('Local IP'),
			_('Local address(es) to use in IKE negotiation'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('general', form.MultiValue, 'crypto_proposal', _('Crypto Proposal'),
			_('List of IKE (phase 1) proposals to use for authentication'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'crypto_proposal');
			if (sections.length == 0) {
				this.value('', _('Please create a Proposal first'));
			} else {
				sections.forEach(L.bind(function (section) {
					if (section.is_esp != '1') {
						this.value(section['.name']);
					}
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		o = s.taboption('general', form.MultiValue, 'tunnel', _('Tunnel'),
			_('The Tunnel containing the ESP (phase 2) section'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'tunnel');
			if (sections.length == 0) {
				this.value('', _('Please create a Tunnel first'));
			} else {
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		o = s.taboption('authentication', form.ListValue, 'authentication_method',
			_('Authentication Method'), _('IKE authentication (phase 1)'));
		o.modalonly = true;
		o.value('psk', 'Pre-shared Key');
		o.value('pubkey', 'Public Key');

		o = s.taboption('authentication', form.Value, 'local_identifier', _('Local Identifier'),
			_('Local identifier for IKE (phase 1)'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=headquarters';
		o.modalonly = true;

		o = s.taboption('authentication', form.Value, 'remote_identifier', _('Remote Identifier'),
			_('Remote identifier for IKE (phase 1)'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=soho';
		o.modalonly = true;

		o = s.taboption('authentication', form.Value, 'pre_shared_key', _('Pre-Shared Key'),
			_('The pre-shared key for the tunnel'));
		o.datatype = 'string';
		o.password = true;
		o.modalonly = true;
		o.rmempty = false;
		o.depends('authentication_method', 'psk');

		o = s.taboption('authentication', form.Value, 'local_cert', _('Local Certificate'),
			_('Certificate pathname to use for authentication'));
		o.datatype = 'file';
		o.depends('authentication_method', 'pubkey');
		o.modalonly = true;

		o = s.taboption('authentication', form.Value, 'local_key', _('Local Key'),
			_('Private key pathname to use with above certificate'));
		o.datatype = 'file';
		o.modalonly = true;

		o = s.taboption('authentication', form.Value, 'ca_cert', _('CA Certificate'),
			_("CA certificate that need to lie in remote peer's certificate's path of trust"));
		o.datatype = 'file';
		o.depends('authentication_method', 'pubkey');
		o.modalonly = true;


		o = s.taboption('advanced', form.Flag, 'mobike', _('MOBIKE'),
			_('MOBIKE (IKEv2 Mobility and Multihoming Protocol)'));
		o.default = '1';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'fragmentation', _('IKE Fragmentation'),
			_('Use IKE fragmentation'));
		o.value('yes');
		o.value('no');
		o.value('force');
		o.value('accept');
		o.default = 'yes';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'keyingtries', _('Keying Retries'),
			_('Number of retransmissions attempts during initial negotiation'));
		o.datatype = 'uinteger';
		o.default = '3';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'dpddelay', _('DPD Delay'),
			_('Interval to check liveness of a peer'));
		o.validate = validateTimeFormat;
		o.default = '30s';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'inactivity', _('Inactivity'),
			_('Interval before closing an inactive CHILD_SA'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rekeytime', _('Rekey Time'),
			_('IKEv2 interval to refresh keying material; also used to compute lifetime'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'overtime', _('Overtime'),
			_('Limit on time to complete rekeying/reauthentication'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'keyexchange', _('Keyexchange'),
			_('Version of IKE for negotiation'));
		o.value('ikev1', 'IKEv1 (%s)', _('deprecated'));
		o.value('ikev2', 'IKEv2');
		o.value('ike', 'IKE (%s, %s)'.format(_('both'), _('deprecated')));
		o.default = 'ikev2';
		o.modalonly = true;

		// Tunnel Configuration
		s = m.section(form.GridSection, 'tunnel', _('Tunnel Configuration'),
			_('Define Connection Children to be used as Tunnels in Remote Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		o = s.tab('general', _('General'));
		o = s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.DynamicList, 'local_subnet', _('Local Subnet'),
			_('Local network(s)'));
		o.datatype = 'subnet';
		o.placeholder = '192.168.1.1/24';
		o.rmempty = false;

		o = s.taboption('general', form.DynamicList, 'remote_subnet', _('Remote Subnet'),
			_('Remote network(s)'));
		o.datatype = 'subnet';
		o.placeholder = '192.168.2.1/24';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'local_nat', _('Local NAT'),
			_('NAT range for tunnels with overlapping IP addresses'));
		o.datatype = 'subnet';
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'if_id', ('XFRM Interface ID'),
			_('XFRM interface ID set on input and output interfaces'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var xfrmSections = uci.sections('network').filter(function (section) {
				return section.proto == 'xfrm';
			});

			xfrmSections.forEach(L.bind(function (section) {
				this.value(section.ifid,
					'%s (%s)'.format(section.ifid, section['.name']));
			}, this));

			return this.super('load', [section_id]);
		}
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'startaction', _('Start Action'),
			_('Action on initial configuration load'));
		o.value('none');
		o.value('trap');
		o.value('start');
		o.default = 'trap';
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'closeaction', _('Close Action'),
			_('Action when CHILD_SA is closed'));
		o.value('none');
		o.value('trap');
		o.value('start');
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('general', form.MultiValue, 'crypto_proposal',
			_('Crypto Proposal (Phase 2)'),
			_('List of ESP (phase two) proposals. Only Proposals with checked ESP flag are selectable'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'crypto_proposal');
			if (sections.length == 0) {
				this.value('', _('Please create an ESP Proposal first'));
			} else {
				sections.forEach(L.bind(function (section) {
					if (section.is_esp == '1') {
						this.value(section['.name']);
					}
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'updown', _('Up/Down Script Path'),
			_('Path to script to run on CHILD_SA up/down events'));
		o.datatype = 'file';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'lifetime', _('Lifetime'),
			_('Maximum duration of the CHILD_SA before closing'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'dpdaction', _('DPD Action'),
			_('Action when DPD timeout occurs'));
		o.value('none');
		o.value('clear');
		o.value('trap');
		o.value('start');
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rekeytime', _('Rekey Time'),
			_('Duration of the CHILD_SA before rekeying'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'ipcomp', _('IPComp'),
			_('Enable ipcomp compression'));
		o.default = '0';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'hw_offload', _('H/W Offload'),
			_('Enable Hardware offload'));
		o.value('yes');
		o.value('no');
		o.value('auto');
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'priority', _('Priority'),
			_('Priority of the CHILD_SA'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'replay_window', _('Replay Window'),
			'%s; %s'.format(_('Replay Window of the CHILD_SA'),
				_('Values larger than 32 are supported by the Netlink backend only')));
		o.datatype = 'uinteger';
		o.modalonly = true;

		// Crypto Proposals
		s = m.section(form.GridSection, 'crypto_proposal',
			_('Encryption Proposals'),
			_('Configure Cipher Suites to define IKE (Phase 1) or ESP (Phase 2) Proposals.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		o = s.option(form.Flag, 'is_esp', _('ESP Proposal'),
			_('Whether this is an ESP (phase 2) proposal or not'));

		o = s.option(form.ListValue, 'encryption_algorithm',
			_('Encryption Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.default = 'aes256gcm128';
		addAlgorithms(o, strongswan_algorithms.getEncryptionAlgorithms());
		addAlgorithms(o, strongswan_algorithms.getAuthenticatedEncryptionAlgorithms());


		o = s.option(form.ListValue, 'hash_algorithm', _('Hash Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		strongswan_algorithms.getEncryptionAlgorithms().forEach(function (algorithm) {
			o.depends('encryption_algorithm', algorithm);
		});
		o.default = 'sha512';
		o.rmempty = false;
		addAlgorithms(o, strongswan_algorithms.getHashAlgorithms());

		o = s.option(form.ListValue, 'dh_group', _('Diffie-Hellman Group'),
			_('Algorithms marked with * are considered insecure'));
		o.default = 'modp3072';
		addAlgorithms(o, strongswan_algorithms.getDiffieHellmanAlgorithms());

		o = s.option(form.ListValue, 'prf_algorithm', _('PRF Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.validate = function (section_id, value) {
			var encryptionAlgorithm = this.section.formvalue(section_id, 'encryption_algorithm');

			if (strongswan_algorithms.getAuthenticatedEncryptionAlgorithms().includes(
					encryptionAlgorithm) && !value) {
				return _('PRF Algorithm must be configured when using an Authenticated Encryption Algorithm');
			}

			return true;
		};
		o.optional = true;
		o.depends('is_esp', '0');
		addAlgorithms(o, strongswan_algorithms.getPrfAlgorithms());

			let page = m.render();
			// Create Basic / Advanced mode toggle
			const basicDiv = E('div', { id: 'swanctl-basic-mode' }, [ page ]);
			const advancedDiv = E('div', { id: 'swanctl-advanced-mode', style: 'display:none' }, [ this.renderRawConfiguration() ]);

			const basicBtn = E('button', {
				'class': 'cbi-button',
				'click': function () {
					basicDiv.style.display = 'block';
					advancedDiv.style.display = 'none';
					this.classList.add('cbi-button-primary');
					if (advBtn) advBtn.classList.remove('cbi-button-primary');
				}
			}, [_('Basic Mode')]);

			const advBtn = E('button', {
				'class': 'cbi-button cbi-button-primary',
				'click': function () {
					basicDiv.style.display = 'none';
					advancedDiv.style.display = 'block';
					this.classList.add('cbi-button-primary');
					if (basicBtn) basicBtn.classList.remove('cbi-button-primary');
				}
			}, [_('Advanced Mode')]);

			const toggleBar = E('div', { 'class': 'cbi-value' }, [ basicBtn, E('span', { style: 'width:0.5em;display:inline-block' }), advBtn ]);

			return E('div', [ E('div', { 'class': 'cbi-section-node' }, [ toggleBar ]), basicDiv, advancedDiv ]);
		},

	renderRawConfiguration: function () {
		const rawNameId = 'swanctl-raw-connection-name';
		const rawEditorId = 'swanctl-raw-configuration';
		const rawPathId = 'swanctl-raw-config-path';
		const rawChildId = 'swanctl-raw-child';
		const rawStatusId = 'swanctl-raw-status';

		const sanitizeConnectionName = function (name) {
			return name.trim()
				.replace(/[^a-zA-Z0-9_.-]/g, '_')
				.replace(/^[-_.]+|[-_.]+$/g, '');
		};

		const updateConfigPath = function () {
			const name = document.getElementById(rawNameId).value || '';
			const sanitized = sanitizeConnectionName(name);
			const pathText = sanitized ? '/etc/swanctl/conf.d/' + sanitized + '.conf' : _('Connection name is required to build the filename');
			document.getElementById(rawPathId).textContent = pathText;
		};

		const setStatusText = function (message, status) {
			const statusNode = document.getElementById(rawStatusId);
			if (!statusNode) return;
			statusNode.textContent = message;
			statusNode.style.color = status === 'connected' ? '#2a7f2a' : status === 'error' ? '#a00' : '#444';
		};

		const getConnectionStatus = function () {
			const connectionName = document.getElementById(rawNameId).value.trim();
			const sanitized = sanitizeConnectionName(connectionName);

			if (!connectionName) {
				setStatusText(_('Connection name is required for status.'), 'error');
				return Promise.resolve({ connected: false, message: _('Connection name is required.') });
			}

			return fs.exec_direct('/usr/sbin/swanmon', ['list-sas'], 'json')
				.then(function (reply) {
					const sas = reply.data || [];
					const matches = sas.filter(function (conn) {
						const name = Object.keys(conn)[0];
						const data = conn[name];
						if (name === sanitized || name === connectionName) {
							return true;
						}
						return Object.keys(data['child-sas'] || {}).some(function (child) {
							return child === sanitized || child === connectionName;
						});
					});

					if (!matches.length) {
						setStatusText(_('Not connected'), 'disconnected');
						return { connected: false, message: _('Not connected') };
					}

					const states = matches.map(function (conn) {
						const name = Object.keys(conn)[0];
						return conn[name].state || _('Unknown');
					});
					const message = _('Connected (%s)').format(states.join(', '));
					setStatusText(message, 'connected');
					return { connected: true, message: message };
				})
				.catch(function (err) {
					setStatusText(_('Status unavailable: %s').format(err.message || String(err)), 'error');
					throw err;
				});
		};

		const sanitizeChildName = function (name) {
			return name.trim()
				.replace(/[^a-zA-Z0-9_.-]/g, '_')
				.replace(/^[-_.]+|[-_.]+$/g, '');
		};

		const showResult = function (title, message, success) {
			ui.addNotification(title,
				E('pre', { 'style': 'white-space: pre-wrap; overflow-x: auto; max-height: 280px;' }, message || _('No output.')),
				success ? 'positive' : 'negative');
		};

		const validateRawConfig = function (config) {
			const trimmed = config.trim();
			if (!trimmed) {
				return _('Configuration cannot be empty.');
			}

			const hasBlock = /\b(connections|secrets|include)\b/i.test(trimmed);
			if (!hasBlock) {
				return _('Configuration should contain at least one swanctl block like connections, secrets or include.');
			}

			const opens = (trimmed.match(/\{/g) || []).length;
			const closes = (trimmed.match(/\}/g) || []).length;
			if (opens !== closes) {
				return _('The configuration contains mismatched braces.');
			}

			return true;
		};

		const confirmOverwriteIfExists = function (path) {
			return fs.stat(path)
				.then(function () {
					return confirm(_('A configuration file already exists at %s. Overwrite it?').format(path));
				})
				.catch(function () {
					return true;
				});
		};

		const saveRawConfig = function () {
			const connectionName = document.getElementById(rawNameId).value.trim();
			const rawValue = document.getElementById(rawEditorId).value;
			const sanitized = sanitizeConnectionName(connectionName);

			if (!connectionName) {
				return alert(_('Connection Name cannot be empty.'));
			}

			if (!sanitized) {
				return alert(_('Connection Name contains invalid characters. Use letters, digits, dot, underscore or hyphen.'));
			}

			const validation = validateRawConfig(rawValue);
			if (validation !== true) {
				return alert(validation);
			}

			const path = '/etc/swanctl/conf.d/' + sanitized + '.conf';
			return fs.exec('/bin/mkdir', ['-p', '/etc/swanctl/conf.d'])
				.then(function () {
					return confirmOverwriteIfExists(path);
				})
				.then(function (overwrite) {
					if (!overwrite) {
						throw new Error(_('Save canceled by user.'));
					}
					return fs.write(path, rawValue, 0o644);
				})
				.then(function () {
					return fs.exec('/usr/sbin/swanctl', ['--load-all']);
				})
				.then(function () {
					updateConfigPath();
					showResult(_('Saved'), _('Raw strongSwan configuration saved to %s').format(path), true);
					return getConnectionStatus();
				})
				.catch(function (err) {
					if (err && err.message === _('Save canceled by user.')) {
						return;
					}
					showResult(_('Save failed'), err.message || String(err), false);
				});
		};

		const connectRawConfig = function () {
			const rawChild = (document.getElementById(rawChildId) || { value: '' }).value;
			const child = sanitizeChildName(rawChild);
			if (rawChild.trim() && !child) {
				return alert(_('Child name contains invalid characters. Use letters, digits, dot, underscore or hyphen.'));
			}
			if (rawChild.trim() && child !== rawChild.trim()) {
				return alert(_('Child name contains invalid characters. Use letters, digits, dot, underscore or hyphen.'));
			}
			return fs.exec('/usr/sbin/swanctl', ['--load-all'])
				.then(function () {
					if (child) return fs.exec('/usr/sbin/swanctl', ['--initiate', '--child', child]);
					return fs.exec('/usr/sbin/swanctl', ['--initiate', '--all']);
				})
				.then(function () {
					if (child)
						showResult(_('Connect'), _('Initiated child %s').format(child), true);
					else
						showResult(_('Connect'), _('All configured strongSwan connections have been initiated.'), true);
					return getConnectionStatus();
				})
				.catch(function (err) {
					showResult(_('Connect failed'), err.message || String(err), false);
				});
		};

		const disconnectRawConfig = function () {
			const rawChild = (document.getElementById(rawChildId) || { value: '' }).value;
			const child = sanitizeChildName(rawChild);
			if (rawChild.trim() && !child) {
				return alert(_('Child name contains invalid characters. Use letters, digits, dot, underscore or hyphen.'));
			}
			if (rawChild.trim() && child !== rawChild.trim()) {
				return alert(_('Child name contains invalid characters. Use letters, digits, dot, underscore or hyphen.'));
			}
			if (child) {
				return fs.exec('/usr/sbin/swanctl', ['--terminate', '--child', child])
					.then(function () {
						showResult(_('Disconnect'), _('Terminated child %s').format(child), true);
						return getConnectionStatus();
					})
					.catch(function (err) {
						showResult(_('Disconnect failed'), err.message || String(err), false);
					});
			}

			return fs.exec('/usr/sbin/swanctl', ['--terminate', '--all'])
				.then(function () {
					showResult(_('Disconnect'), _('All strongSwan connections have been terminated.'), true);
					return getConnectionStatus();
				})
				.catch(function (err) {
					showResult(_('Disconnect failed'), err.message || String(err), false);
				});
		};

		const statusRawConfig = function () {
			return getConnectionStatus()
				.then(function (status) {
					showResult(_('Status'), status.message, true);
				})
				.catch(function (err) {
					showResult(_('Status failed'), err.message || String(err), false);
				});
		};

		return E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('h2', { 'class': 'cbi-section-title' }, [_('Raw Configuration')]),
				E('p', { 'class': 'cbi-section-desc' }, [_('Paste a swanctl.conf fragment and save it directly to /etc/swanctl/conf.d/. You can then reload, connect, or disconnect from this UI.')]),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title', 'for': rawNameId }, [_('Connection Name')]),
						E('input', {
							id: rawNameId,
							type: 'text',
							'class': 'cbi-input-text',
							autocomplete: 'off',
							placeholder: _('AWS-Test'),
							input: updateConfigPath,
							change: updateConfigPath
						})
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title', 'for': rawEditorId }, [_('Configuration')]),
						E('textarea', {
							id: rawEditorId,
							'class': 'cbi-textarea',
							rows: 20,
							placeholder: _('paste swanctl.conf fragment here')
						})
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title', 'for': rawChildId }, [_('Child (optional)')]),
						E('input', {
							id: rawChildId,
							type: 'text',
							'class': 'cbi-input-text',
							autocomplete: 'off',
							placeholder: _('child name to initiate/terminate')
						})
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('span', { 'class': 'cbi-value-title' }, [_('Target file')]),
						E('div', { id: rawPathId, 'class': 'cbi-value-field' }, [_('Connection name is required to build the filename')])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('span', { 'class': 'cbi-value-title' }, [_('Connection Status')]),
						E('div', { id: rawStatusId, 'class': 'cbi-value-field' }, [_('Unknown. Click Status to refresh.')])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('button', {
							'class': 'cbi-button cbi-button-positive',
							click: saveRawConfig
						}, [_('Save')]),
						E('button', {
							'class': 'cbi-button cbi-button-primary',
							click: connectRawConfig,
							style: 'margin-left: 0.5em;'
						}, [_('Connect')]),
						E('button', {
							'class': 'cbi-button cbi-button-negative',
							click: disconnectRawConfig,
							style: 'margin-left: 0.5em;'
						}, [_('Disconnect')]),
						E('button', {
							'class': 'cbi-button cbi-button-secondary',
							click: statusRawConfig,
							style: 'margin-left: 0.5em;'
						}, [_('Status')])
					])
				])
			])
		]);
	}

'use strict';
'require view';
'require ui';
'require fs';

const confDir = '/etc/ipsec.d';
const filePrefix = 'luci-';
const fileSuffix = '.conf';

function sanitizeName(name) {
	return name.trim()
		.replace(/[^a-zA-Z0-9_.-]/g, '_')
		.replace(/^[-_.]+|[-_.]+$/g, '');
}

function filenameToName(filename) {
	return filename.replace(new RegExp('^' + filePrefix), '').replace(/\.conf$/i, '');
}

function nameToPath(name) {
	return '%s/%s%s%s'.format(confDir, filePrefix, sanitizeName(name), fileSuffix);
}

function validateConfig(name, config) {
	const trimmed = config.trim();
	const sanitized = sanitizeName(name);

	if (!name.trim())
		return _('Connection name cannot be empty.');

	if (!sanitized || sanitized !== name.trim())
		return _('Connection name may only contain letters, digits, dot, underscore or hyphen.');

	if (!trimmed)
		return _('Configuration cannot be empty.');

	if (!new RegExp('(^|\\n)\\s*conn\\s+' + sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|\\n|$)').test(trimmed))
		return _('Configuration must contain a conn block matching the connection name.');

	return true;
}

return view.extend({
	render: function() {
		const listId = 'libreswan-raw-config-list';
		const nameId = 'libreswan-raw-connection-name';
		const editorId = 'libreswan-raw-configuration';
		const pathId = 'libreswan-raw-config-path';
		const statusId = 'libreswan-raw-status';

		const setStatus = function(message, state) {
			const node = document.getElementById(statusId);
			if (!node)
				return;

			node.textContent = message;
			node.style.color = state === 'error' ? '#a00' : state === 'connected' ? '#2a7f2a' : '#444';
		};

		const showResult = function(title, message, success) {
			ui.addNotification(title,
				E('pre', { 'style': 'white-space: pre-wrap; overflow-x: auto; max-height: 280px;' }, [ message || _('No output.') ]),
				success ? 'info' : 'error');
		};

		const updatePath = function() {
			const name = document.getElementById(nameId).value || '';
			const sanitized = sanitizeName(name);
			document.getElementById(pathId).textContent = sanitized
				? nameToPath(sanitized)
				: _('Connection name is required to build the filename');
		};

		const getSelectedPath = function() {
			const list = document.getElementById(listId);
			return list && list.value ? '%s/%s'.format(confDir, list.value) : null;
		};

		const refreshList = function(selectedName) {
			const list = document.getElementById(listId);
			if (!list)
				return Promise.resolve();

			return L.resolveDefault(fs.list(confDir), []).then(function(entries) {
				const configs = entries.filter(function(entry) {
					return entry.type === 'file' &&
						entry.name.indexOf(filePrefix) === 0 &&
						entry.name.match(/\.conf$/i);
				}).sort(function(a, b) {
					return a.name.localeCompare(b.name);
				});

				list.innerHTML = '';
				list.appendChild(E('option', { value: '' }, [ _('Select saved configuration') ]));

				configs.forEach(function(entry) {
					list.appendChild(E('option', { value: entry.name }, [ filenameToName(entry.name) ]));
				});

				if (selectedName)
					list.value = '%s%s%s'.format(filePrefix, sanitizeName(selectedName), fileSuffix);
			}).catch(function(err) {
				setStatus(_('Unable to list %s: %s').format(confDir, err.message || String(err)), 'error');
			});
		};

		const loadSelected = function() {
			const path = getSelectedPath();
			if (!path)
				return;

			return fs.read(path).then(function(data) {
				const filename = document.getElementById(listId).value;
				document.getElementById(nameId).value = filenameToName(filename);
				document.getElementById(editorId).value = data;
				updatePath();
				setStatus(_('Loaded %s').format(path), 'disconnected');
			}).catch(function(err) {
				showResult(_('Load failed'), err.message || String(err), false);
			});
		};

		const newConfig = function() {
			document.getElementById(listId).value = '';
			document.getElementById(nameId).value = '';
			document.getElementById(editorId).value = '';
			updatePath();
			setStatus(_('New configuration'), 'disconnected');
		};

		const saveConfig = function() {
			const name = document.getElementById(nameId).value.trim();
			const config = document.getElementById(editorId).value;
			const valid = validateConfig(name, config);

			if (valid !== true)
				return alert(valid);

			const path = nameToPath(name);

			return fs.write(path, config, 0o600).then(function() {
				showResult(_('Saved'), _('Libreswan configuration saved to %s').format(path), true);
				return refreshList(name);
			}).catch(function(err) {
				showResult(_('Save failed'), err.message || String(err), false);
			});
		};

		const runIpsec = function(args, title, successMessage) {
			const name = sanitizeName(document.getElementById(nameId).value || '');
			if (args.indexOf('%name%') !== -1) {
				if (!name)
					return alert(_('Connection name is required.'));
				args = args.map(function(arg) { return arg === '%name%' ? name : arg; });
			}

			return fs.exec('/usr/sbin/ipsec', args).then(function(res) {
				const output = [ res.stdout, res.stderr ].filter(Boolean).join('\n');
				showResult(title, output || successMessage, true);
				setStatus(successMessage, title === _('Connect') ? 'connected' : 'disconnected');
			}).catch(function(err) {
				showResult(_('%s failed').format(title), err.message || String(err), false);
				setStatus(err.message || String(err), 'error');
			});
		};

		const basicDiv = E('div', { id: 'libreswan-basic-mode' }, [
			E('div', { 'class': 'cbi-map' }, [
				E('h2', {}, [ _('Libreswan Configuration') ]),
				E('div', { 'class': 'cbi-section' }, [
					E('p', { 'class': 'cbi-section-desc' }, [
						_('Use the existing form pages for normal UCI-based setup, or switch to Advanced Mode to save multiple raw libreswan client configurations.')
					]),
					E('div', { 'class': 'cbi-section-node' }, [
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, [ _('Form configuration') ]),
							E('div', { 'class': 'cbi-value-field' }, [
								E('button', {
									'class': 'cbi-button',
									click: function() { location.href = L.url('admin/vpn/libreswan/globals'); }
								}, [ _('Globals') ]),
								E('button', {
									'class': 'cbi-button',
									style: 'margin-left: 0.5em;',
									click: function() { location.href = L.url('admin/vpn/libreswan/proposals'); }
								}, [ _('Proposals') ]),
								E('button', {
									'class': 'cbi-button',
									style: 'margin-left: 0.5em;',
									click: function() { location.href = L.url('admin/vpn/libreswan/tunnels'); }
								}, [ _('Tunnels') ])
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, [ _('Status') ]),
							E('div', { 'class': 'cbi-value-field' }, [
								E('button', {
									'class': 'cbi-button',
									click: function() { location.href = L.url('admin/vpn/libreswan/overview'); }
								}, [ _('Open Overview') ])
							])
						])
					])
				])
			])
		]);

		const advancedDiv = E('div', { id: 'libreswan-advanced-mode', style: 'display:none' }, [
			E('div', { 'class': 'cbi-map' }, [
				E('h2', {}, [ _('Raw Libreswan Configuration') ]),
				E('div', { 'class': 'cbi-section' }, [
					E('p', { 'class': 'cbi-section-desc' }, [
						_('Save one named conn configuration per file. Files are written as /etc/ipsec.d/luci-<name>.conf and must be included by the active libreswan ipsec.conf to be loaded.')
					]),
					E('div', { 'class': 'cbi-section-node' }, [
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title', 'for': listId }, [ _('Saved Configurations') ]),
							E('div', { 'class': 'cbi-value-field' }, [
								E('select', {
									id: listId,
									'class': 'cbi-input-select',
									change: loadSelected
								}, [
									E('option', { value: '' }, [ _('Select saved configuration') ])
								]),
								E('button', { 'class': 'cbi-button', style: 'margin-left: 0.5em;', click: loadSelected }, [ _('Load') ]),
								E('button', { 'class': 'cbi-button', style: 'margin-left: 0.5em;', click: newConfig }, [ _('New') ]),
								E('button', { 'class': 'cbi-button', style: 'margin-left: 0.5em;', click: function() { return refreshList(); } }, [ _('Refresh') ])
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title', 'for': nameId }, [ _('Connection Name') ]),
							E('input', {
								id: nameId,
								type: 'text',
								'class': 'cbi-input-text',
								autocomplete: 'off',
								placeholder: _('client1'),
								input: updatePath,
								change: updatePath
							})
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title', 'for': editorId }, [ _('Configuration') ]),
							E('textarea', {
								id: editorId,
								'class': 'cbi-textarea',
								rows: 22,
								placeholder: 'conn client1\n\tauto=add\n\tleft=%defaultroute\n\tleftid=@client1\n\tright=198.51.100.10\n\trightsubnet=10.10.0.0/24\n\tauthby=secret'
							})
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('span', { 'class': 'cbi-value-title' }, [ _('Target file') ]),
							E('div', { id: pathId, 'class': 'cbi-value-field' }, [ _('Connection name is required to build the filename') ])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('span', { 'class': 'cbi-value-title' }, [ _('Connection Status') ]),
							E('div', { id: statusId, 'class': 'cbi-value-field' }, [ _('Unknown') ])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('button', { 'class': 'cbi-button cbi-button-positive', click: saveConfig }, [ _('Save') ]),
							E('button', {
								'class': 'cbi-button',
								style: 'margin-left: 0.5em;',
								click: function() { return runIpsec([ 'auto', '--add', '%name%' ], _('Load'), _('Loaded connection')); }
							}, [ _('Load into IPsec') ]),
							E('button', {
								'class': 'cbi-button cbi-button-primary',
								style: 'margin-left: 0.5em;',
								click: function() { return runIpsec([ 'auto', '--up', '%name%' ], _('Connect'), _('Connection initiated')); }
							}, [ _('Connect') ]),
							E('button', {
								'class': 'cbi-button cbi-button-negative',
								style: 'margin-left: 0.5em;',
								click: function() { return runIpsec([ 'auto', '--down', '%name%' ], _('Disconnect'), _('Connection terminated')); }
							}, [ _('Disconnect') ]),
							E('button', {
								'class': 'cbi-button',
								style: 'margin-left: 0.5em;',
								click: function() { return runIpsec([ 'auto', '--status' ], _('Status'), _('Status refreshed')); }
							}, [ _('Status') ])
						])
					])
				])
			])
		]);

		const basicBtn = E('button', {
			'class': 'cbi-button cbi-button-primary',
			click: function() {
				basicDiv.style.display = 'block';
				advancedDiv.style.display = 'none';
				basicBtn.classList.add('cbi-button-primary');
				advancedBtn.classList.remove('cbi-button-primary');
			}
		}, [ _('Basic Mode') ]);

		const advancedBtn = E('button', {
			'class': 'cbi-button',
			click: function() {
				basicDiv.style.display = 'none';
				advancedDiv.style.display = 'block';
				advancedBtn.classList.add('cbi-button-primary');
				basicBtn.classList.remove('cbi-button-primary');
			}
		}, [ _('Advanced Mode') ]);

		window.setTimeout(refreshList, 0);

		return E('div', [
			E('div', { 'class': 'cbi-section-node' }, [
				E('div', { 'class': 'cbi-value' }, [
					basicBtn,
					E('span', { style: 'width:0.5em;display:inline-block' }),
					advancedBtn
				])
			]),
			basicDiv,
			advancedDiv
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});

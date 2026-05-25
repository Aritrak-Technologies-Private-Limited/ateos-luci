'use strict';
'require dom';
'require ui';
'require view';

var mockInterfaces = [
	{
		id: 'wan1',
		interface: 'WAN1',
		port: 'PORT1',
		status: 'Enabled',
		protocol: 'DHCP',
		address: '',
		metric: ''
	},
	{
		id: 'wan5',
		interface: 'WAN5',
		port: 'PORT5',
		status: 'Enabled',
		protocol: 'STATIC',
		address: '10.10.0.10',
		metric: ''
	}
];

function byId(id) {
	return document.getElementById(id);
}

function selectedValue(name) {
	var node = document.querySelector('input[name="%s"]:checked'.format(name));
	return node ? node.value : '';
}

function setSelectedValue(name, value) {
	var nodes = document.querySelectorAll('input[name="%s"]'.format(name));

	for (var i = 0; i < nodes.length; i++)
		nodes[i].checked = nodes[i].value == value;
}

function protocolLabel(mode) {
	return mode == 'disable' ? 'DISABLE' : mode.toUpperCase();
}

return view.extend({
	render: function() {
		if (!document.getElementById('lanwanlan-style')) {
			document.head.appendChild(E('link', {
				'id': 'lanwanlan-style',
				'rel': 'stylesheet',
				'href': L.resource('lanwanlan/style.css')
			}));
		}

		var editingId = null;

		function formValue(name) {
			var node = byId('lanwanlan-%s'.format(name));
			return node ? node.value.trim() : '';
		}

		function resetForm() {
			editingId = null;
			byId('lanwanlan-port').value = 'PORT2';
			byId('lanwanlan-description').value = '';
			byId('lanwanlan-vlan').value = '';
			byId('lanwanlan-ifname').value = '';
			byId('lanwanlan-zone').value = '';
			setSelectedValue('lanwanlan-type', 'wan');
			setSelectedValue('lanwanlan-mode', 'disable');
		}

		function renderRows() {
			var tbody = byId('lanwanlan-current-body');

			if (!mockInterfaces.length) {
				dom.content(tbody, E('tr', {}, [
					E('td', { 'colspan': 7, 'class': 'lanwanlan-empty' }, _('No interfaces configured yet.'))
				]));
				return;
			}

			dom.content(tbody, mockInterfaces.map(function(item) {
				return E('tr', { 'data-id': item.id }, [
					E('td', {}, E('span', { 'class': 'lanwanlan-badge' }, item.interface)),
					E('td', {}, item.port),
					E('td', {}, item.status),
					E('td', {}, item.protocol),
					E('td', {}, item.address || ''),
					E('td', {}, item.metric || ''),
					E('td', {}, E('div', { 'class': 'lanwanlan-row-actions' }, [
						E('button', {
							'type': 'button',
							'class': 'lanwanlan-icon-action',
							'title': _('Edit'),
							'click': function() {
								editingId = item.id;
								byId('lanwanlan-port').value = item.port;
								byId('lanwanlan-description').value = item.description || '';
								byId('lanwanlan-vlan').value = item.vlan || '';
								byId('lanwanlan-ifname').value = item.interface;
								byId('lanwanlan-zone').value = item.zone || '';
								setSelectedValue('lanwanlan-type', item.type || 'wan');
								setSelectedValue('lanwanlan-mode', (item.protocol || 'disable').toLowerCase());
							}
						}, 'Edit'),
						E('button', {
							'type': 'button',
							'class': 'lanwanlan-icon-action',
							'title': _('Delete'),
							'click': function() {
								mockInterfaces = mockInterfaces.filter(function(row) {
									return row.id != item.id;
								});
								renderRows();
							}
						}, 'Delete')
					]))
				]);
			}));
		}

		function saveInterface() {
			var type = selectedValue('lanwanlan-type') || 'wan',
			    mode = selectedValue('lanwanlan-mode') || 'disable',
			    ifname = formValue('ifname') || (type == 'wan' ? 'WAN' : 'LAN'),
			    row = {
				id: editingId || '%s-%d'.format(type, Date.now()),
				interface: ifname.toUpperCase(),
				port: formValue('port') || 'PORT1',
				status: mode == 'disable' ? 'Disabled' : 'Enabled',
				protocol: protocolLabel(mode),
				address: mode == 'static' ? '10.10.0.10' : '',
				metric: '',
				type: type,
				description: formValue('description'),
				vlan: formValue('vlan'),
				zone: formValue('zone')
			};

			if (editingId) {
				mockInterfaces = mockInterfaces.map(function(item) {
					return item.id == editingId ? row : item;
				});
			}
			else {
				mockInterfaces.push(row);
			}

			renderRows();
			resetForm();

			ui.addNotification(null, E('p', _('WAN/LAN UI entry saved locally. Backend apply logic will be added later.')), 'info');
		}

		var page = E('div', { 'class': 'lanwanlan-page' }, [
			E('div', { 'class': 'lanwanlan-layout' }, [
				E('section', { 'class': 'lanwanlan-card lanwanlan-config-card' }, [
					E('h2', {}, _('Interface Configuration')),
					E('div', { 'class': 'lanwanlan-field' }, [
						E('label', { 'for': 'lanwanlan-port' }, _('Port')),
						E('select', { 'id': 'lanwanlan-port' }, [
							E('option', { 'value': 'PORT1' }, 'PORT1'),
							E('option', { 'value': 'PORT2', 'selected': 'selected' }, 'PORT2'),
							E('option', { 'value': 'PORT3' }, 'PORT3'),
							E('option', { 'value': 'PORT4' }, 'PORT4'),
							E('option', { 'value': 'PORT5' }, 'PORT5')
						])
					]),
					E('div', { 'class': 'lanwanlan-field' }, [
						E('label', { 'for': 'lanwanlan-description' }, _('Description')),
						E('input', { 'id': 'lanwanlan-description', 'type': 'text' })
					]),
					E('div', { 'class': 'lanwanlan-field' }, [
						E('div', { 'class': 'lanwanlan-radio-title' }, _('Interface Type')),
						E('div', { 'class': 'lanwanlan-radio-stack' }, [
							E('label', {}, [
								E('input', { 'type': 'radio', 'name': 'lanwanlan-type', 'value': 'wan' }),
								'WAN'
							]),
							E('label', {}, [
								E('input', { 'type': 'radio', 'name': 'lanwanlan-type', 'value': 'lan' }),
								'LAN'
							])
						])
					]),
					E('div', { 'class': 'lanwanlan-field' }, [
						E('label', { 'for': 'lanwanlan-vlan' }, _('VLAN ID')),
						E('input', { 'id': 'lanwanlan-vlan', 'type': 'number', 'min': '1', 'max': '4094' })
					]),
					E('div', { 'class': 'lanwanlan-field' }, [
						E('label', { 'for': 'lanwanlan-ifname' }, _('Interface Name')),
						E('input', { 'id': 'lanwanlan-ifname', 'type': 'text' })
					]),
					E('div', { 'class': 'lanwanlan-field' }, [
						E('label', { 'for': 'lanwanlan-zone' }, _('Firewall Zone')),
						E('select', { 'id': 'lanwanlan-zone' }, [
							E('option', { 'value': '' }, ''),
							E('option', { 'value': 'wan' }, 'wan'),
							E('option', { 'value': 'lan' }, 'lan')
						])
					]),
					E('div', { 'class': 'lanwanlan-field' }, [
						E('div', { 'class': 'lanwanlan-radio-title' }, _('Interface Mode')),
						E('div', { 'class': 'lanwanlan-radio-stack' }, [
							E('label', {}, [
								E('input', { 'type': 'radio', 'name': 'lanwanlan-mode', 'value': 'static' }),
								_('Static')
							]),
							E('label', {}, [
								E('input', { 'type': 'radio', 'name': 'lanwanlan-mode', 'value': 'dhcp' }),
								'DHCP'
							]),
							E('label', {}, [
								E('input', { 'type': 'radio', 'name': 'lanwanlan-mode', 'value': 'pppoe' }),
								'PPPoE'
							]),
							E('label', {}, [
								E('input', { 'type': 'radio', 'name': 'lanwanlan-mode', 'value': 'disable' }),
								_('Disable')
							])
						])
					]),
					E('div', { 'class': 'lanwanlan-actions' }, [
						E('button', {
							'type': 'button',
							'class': 'lanwanlan-button lanwanlan-button-save',
							'click': saveInterface
						}, _('Save')),
						E('button', {
							'type': 'button',
							'class': 'lanwanlan-button lanwanlan-button-clear',
							'click': resetForm
						}, _('Clear'))
					])
				]),
				E('section', { 'class': 'lanwanlan-card' }, [
					E('h2', {}, _('Current Interface Configuration')),
					E('div', { 'class': 'lanwanlan-table-wrap' }, [
						E('table', { 'class': 'lanwanlan-table' }, [
							E('thead', {}, E('tr', {}, [
								E('th', {}, _('Interface')),
								E('th', {}, _('Port')),
								E('th', {}, _('Status')),
								E('th', {}, _('Protocol')),
								E('th', {}, _('IP/Username')),
								E('th', {}, _('Metric')),
								E('th', {}, '')
							])),
							E('tbody', { 'id': 'lanwanlan-current-body' })
						])
					])
				])
			])
		]);

		requestAnimationFrame(function() {
			resetForm();
			renderRows();
		});

		return page;
	}
});

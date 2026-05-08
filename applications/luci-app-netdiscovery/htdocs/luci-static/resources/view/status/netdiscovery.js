'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

const callNetDiscovery = rpc.declare({
	object: 'luci.netdiscovery',
	method: 'get',
	expect: {}
});

function dash(value) {
	return value == null || value === '' ? '\u2014' : value;
}

function badge(type) {
	const cls = type == 'wifi' ? 'netdiscovery-badge netdiscovery-badge-wifi' :
		type == 'lldp' ? 'netdiscovery-badge netdiscovery-badge-lldp' :
			type == 'lan' ? 'netdiscovery-badge netdiscovery-badge-lan' : 'netdiscovery-badge';

	return E('span', { 'class': cls }, type || _('unknown'));
}

function addSvg(parent, tag, attrs, children) {
	const node = document.createElementNS('http://www.w3.org/2000/svg', tag);

	for (const key in attrs || {})
		node.setAttribute(key, attrs[key]);

	if (Array.isArray(children)) {
		children.forEach(function(child) {
			node.appendChild(child);
		});
	}
	else if (children != null) {
		node.textContent = children;
	}

	if (parent)
		parent.appendChild(node);

	return node;
}

function graphNode(svg, x, y, r, fill, label, light) {
	const group = addSvg(svg, 'g', { 'class': 'netdiscovery-node' });

	addSvg(group, 'circle', { cx: x, cy: y, r: r, fill: fill });
	addSvg(group, 'text', {
		x: x,
		y: y + 4,
		'class': light ? 'node-label-light' : ''
	}, label);

	return group;
}

function graphEdge(svg, x1, y1, x2, y2) {
	addSvg(svg, 'line', {
		'class': 'netdiscovery-edge',
		x1: x1,
		y1: y1,
		x2: x2,
		y2: y2
	});
}

function countType(devices, type) {
	let n = 0;

	(devices || []).forEach(function(dev) {
		if (dev.type == type)
			n++;
	});

	return n;
}

function renderGraph(data) {
	const devices = data.devices || [];
	const interfaces = data.interfaces || [];
	const neighbors = data.neighbors || [];
	const wifi = devices.filter(dev => dev.type == 'wifi');
	const lan = devices.filter(dev => dev.type != 'wifi');
	const width = 760;
	const height = 360;
	const svg = addSvg(null, 'svg', {
		'class': 'netdiscovery-graph',
		viewBox: '0 0 ' + width + ' ' + height,
		role: 'img',
		'aria-label': _('Network discovery graph')
	});

	graphNode(svg, 380, 178, 46, '#2563eb', data.router?.hostname || _('Router'), true);

	const groups = [
		{ x: 150, y: 96, color: '#16a34a', label: _('LAN'), count: lan.length },
		{ x: 150, y: 260, color: '#0f766e', label: _('WiFi'), count: wifi.length },
		{ x: 610, y: 96, color: '#7c3aed', label: _('LLDP'), count: neighbors.length },
		{ x: 610, y: 260, color: '#64748b', label: _('Interfaces'), count: interfaces.length }
	];

	groups.forEach(function(group) {
		graphEdge(svg, 380, 178, group.x, group.y);
		graphNode(svg, group.x, group.y, 36, group.color, group.label, true);
		addSvg(svg, 'text', {
			x: group.x,
			y: group.y + 58,
			fill: '#475569',
			'font-size': 12,
			'text-anchor': 'middle'
		}, '%d'.format(group.count));
	});

	const preview = devices.slice(0, 8);
	const step = preview.length > 1 ? 540 / (preview.length - 1) : 0;

	preview.forEach(function(dev, idx) {
		const x = 110 + (idx * step);
		const y = dev.type == 'wifi' ? 328 : 28;
		const anchorY = dev.type == 'wifi' ? 260 : 96;

		graphEdge(svg, 150, anchorY, x, y);
		graphNode(svg, x, y, 16, dev.type == 'wifi' ? '#86efac' : '#bfdbfe',
			(dev.hostname || dev.ip || dev.mac || '?').slice(0, 12), false);
	});

	return svg;
}

function renderSummary(data) {
	const devices = data.devices || [];
	const warnings = (data.errors || []).length;

	return E('div', { 'class': 'netdiscovery-summary' }, [
		E('div', { 'class': 'netdiscovery-metric' }, [
			E('strong', devices.length),
			E('span', _('Devices'))
		]),
		E('div', { 'class': 'netdiscovery-metric' }, [
			E('strong', countType(devices, 'wifi')),
			E('span', _('WiFi clients'))
		]),
		E('div', { 'class': 'netdiscovery-metric' }, [
			E('strong', data.interfaces?.length || 0),
			E('span', _('Interfaces'))
		]),
		E('div', { 'class': 'netdiscovery-metric' }, [
			E('strong', data.neighbors?.length || 0),
			E('span', _('LLDP neighbors'))
		]),
		E('div', { 'class': 'netdiscovery-metric' }, [
			E('strong', warnings),
			E('span', _('Warnings'))
		])
	]);
}

function renderDeviceRows(devices) {
	if (!devices || !devices.length) {
		return E('tr', { 'class': 'tr placeholder' }, [
			E('td', { 'class': 'td', colspan: 7 }, E('em', _('No devices discovered yet')))
		]);
	}

	return devices.map(function(dev) {
		return E('tr', { 'class': 'tr cbi-section-table-row' }, [
			E('td', { 'class': 'td' }, dash(dev.hostname)),
			E('td', { 'class': 'td' }, dash(dev.ip)),
			E('td', { 'class': 'td' }, dash(dev.mac)),
			E('td', { 'class': 'td' }, badge(dev.type)),
			E('td', { 'class': 'td' }, dash(dev.interface)),
			E('td', { 'class': 'td' }, dev.signal == null ? '\u2014' : '%d dBm'.format(dev.signal)),
			E('td', { 'class': 'td' }, dash((dev.sources || []).join(', ')))
		]);
	});
}

function renderDeviceTable(data) {
	const rows = renderDeviceRows(data.devices);

	return E('div', { 'class': 'netdiscovery-panel' }, [
		E('h3', _('Connected Devices')),
		E('div', { 'class': 'netdiscovery-table-wrap' }, [
			E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Hostname')),
					E('th', { 'class': 'th' }, _('IP address')),
					E('th', { 'class': 'th' }, _('MAC address')),
					E('th', { 'class': 'th' }, _('Type')),
					E('th', { 'class': 'th' }, _('Interface')),
					E('th', { 'class': 'th' }, _('Signal')),
					E('th', { 'class': 'th' }, _('Sources'))
				])
			].concat(Array.isArray(rows) ? rows : [rows]))
		])
	]);
}

function renderInterfaces(data) {
	const rows = (data.interfaces || []).map(function(iface) {
		const addrs = [].concat(
			(iface.ipv4 || []).map(a => a.address),
			(iface.ipv6 || []).map(a => a.address)
		).filter(Boolean);

		return E('tr', { 'class': 'tr cbi-section-table-row' }, [
			E('td', { 'class': 'td' }, iface.name),
			E('td', { 'class': 'td' }, iface.up ? _('up') : _('down')),
			E('td', { 'class': 'td' }, dash(iface.device)),
			E('td', { 'class': 'td' }, dash(iface.proto)),
			E('td', { 'class': 'td' }, dash(addrs.join(', ')))
		]);
	});

	return E('div', { 'class': 'netdiscovery-panel' }, [
		E('h3', _('Interfaces')),
		E('div', { 'class': 'netdiscovery-table-wrap' }, [
			E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Name')),
					E('th', { 'class': 'th' }, _('State')),
					E('th', { 'class': 'th' }, _('Device')),
					E('th', { 'class': 'th' }, _('Protocol')),
					E('th', { 'class': 'th' }, _('Addresses'))
				])
			].concat(rows.length ? rows : [E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td', colspan: 5 }, E('em', _('No interface data available')))
				])]))
		])
	]);
}

function renderNeighbors(data) {
	const rows = (data.neighbors || []).map(function(neighbor) {
		return E('tr', { 'class': 'tr cbi-section-table-row' }, [
			E('td', { 'class': 'td' }, dash(neighbor.local_port)),
			E('td', { 'class': 'td' }, dash(neighbor.remote_device)),
			E('td', { 'class': 'td' }, dash(neighbor.remote_port)),
			E('td', { 'class': 'td' }, dash(neighbor.protocol))
		]);
	});

	return E('div', { 'class': 'netdiscovery-panel' }, [
		E('h3', _('LLDP Neighbors')),
		E('div', { 'class': 'netdiscovery-table-wrap' }, [
			E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Local port')),
					E('th', { 'class': 'th' }, _('Remote device')),
					E('th', { 'class': 'th' }, _('Remote port')),
					E('th', { 'class': 'th' }, _('Protocol'))
				])
			].concat(rows.length ? rows : [E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td', colspan: 4 }, E('em', _('No LLDP neighbors discovered')))
				])]))
		])
	]);
}

return view.extend({
	load() {
		return callNetDiscovery().catch(function(err) {
			return {
				error: err.message || String(err)
			};
		});
	},

	render(data) {
		const head = document.getElementsByTagName('head')[0];

		if (!document.getElementById('netdiscovery-css')) {
			head.appendChild(E('link', {
				id: 'netdiscovery-css',
				rel: 'stylesheet',
				href: L.resource('netdiscovery/netdiscovery.css') + '?v=#PKG_VERSION'
			}));
		}

		this.content = E('div', {}, [
			E('h2', _('Network Discovery')),
			E('div', { 'data-role': 'netdiscovery-body' }, E('em', { 'class': 'spinning' }, _('Collecting data...')))
		]);

		this.update(data || {});

		poll.add(L.bind(function() {
			return callNetDiscovery().then(L.bind(function(next) {
				this.update(next || {});
			}, this)).catch(function(err) {
				this.update({
					error: err.message || String(err)
				});
				ui.addNotification(null, E('p', _('Unable to refresh net discovery data: %s').format(err.message)), 'warning');
			});
		}, this), 7);

		return this.content;
	},

	update(data) {
		const body = this.content.querySelector('[data-role="netdiscovery-body"]');

		if (!body)
			return;

		if (data.error) {
			body.replaceChildren(E('div', { 'class': 'alert-message warning' }, [
				E('strong', _('Unable to load discovery data')),
				E('br'),
				data.error
			]));
			return;
		}

		const children = [
			renderSummary(data),
			E('div', { 'class': 'netdiscovery-layout' }, [
				E('div', { 'class': 'netdiscovery-panel' }, [
					E('h3', data.router?.model || _('Router')),
					renderGraph(data)
				]),
					E('div', {}, [
						renderInterfaces(data),
						E('div', { 'class': 'netdiscovery-gap' }),
						renderNeighbors(data)
					])
				]),
				E('div', { 'class': 'netdiscovery-gap' }),
				renderDeviceTable(data)
			];

		if ((data.errors || []).length) {
			children.splice(1, 0, E('div', { 'class': 'alert-message warning' }, [
				E('strong', _('Some discovery sources failed')),
				E('br'),
				(data.errors || []).map(function(err) {
					return '%s: %s'.format(err.source || _('unknown'), err.error || _('error'));
				}).join(', ')
			]));
		}

		body.replaceChildren.apply(body, children);
	}
});

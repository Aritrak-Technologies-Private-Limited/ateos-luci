'use strict';
'require baseclass';
'require dom';
'require fs';
'require network';
'require uci';
'require ui';

var firewallZone = '@zone[1]';
var pingHost = '8.8.8.8';
var internetCache = null;
var refreshNode = null;

function listValue(value) {
	if (Array.isArray(value))
		return value.filter(function(v) { return v != null && v !== ''; });

	if (typeof(value) == 'string')
		return value.trim().split(/\s+/).filter(function(v) { return v !== ''; });

	return [];
}

function uniq(values) {
	var seen = {};
	var out = [];

	for (var i = 0; i < values.length; i++) {
		var value = values[i];

		if (!value || seen[value])
			continue;

		seen[value] = true;
		out.push(value);
	}

	return out;
}

function routeIface(stdout) {
	var lines = (stdout || '').split(/\n/);

	for (var i = 0; i < lines.length; i++) {
		var cols = lines[i].trim().split(/\s+/);

		if (cols.length >= 8 && (cols[0] == 'default' || cols[0] == '0.0.0.0'))
			return cols[7];
	}

	return '';
}

function simLabel(no) {
	return no == '2' ? _('SIM 2') : _('SIM 1');
}

function activeSimFromConfig() {
	var mode = uci.get('qtcm', 'sim_switch', 'mode') || 'gpio';
	var gpioValue = uci.get('system', 'sim_switch', 'value');
	var sim1Value = uci.get('qtcm', 'sim_switch', 'sim1_value') || '1';
	var sim2Value = uci.get('qtcm', 'sim_switch', 'sim2_value') || '0';
	var active = uci.get('qtcm', 'main', 'active_sim') || '1';

	if (mode == 'gpio') {
		if (gpioValue == sim1Value)
			return '1';

		if (gpioValue == sim2Value)
			return '2';
	}

	return active == '2' ? '2' : '1';
}

function networkDeviceMap(nets) {
	var map = {};

	for (var i = 0; i < nets.length; i++) {
		var name = nets[i].getName();
		var dev = nets[i].getL3Device();

		map[name] = {
			name: name,
			device: dev ? dev.getName() : name,
			label: dev ? '%s (%s)'.format(name, dev.getName()) : name
		};
	}

	return map;
}

function configuredSources() {
	return listValue(uci.get('firewall', firewallZone, 'network'));
}

function qtcmInterface() {
	return uci.get('qtcm', 'main', 'network_interface') || '';
}

function runChecks(sources, devmap) {
	var routeTask = L.resolveDefault(fs.exec('/sbin/route', [ '-n' ]), { stdout: '' });
	var pingTasks = [];

	for (var i = 0; i < sources.length; i++) {
		var src = sources[i];
		var dev = devmap[src] ? devmap[src].device : src;

		pingTasks.push(L.resolveDefault(
			fs.exec('/bin/ping', [ '-I', dev, '-c', '1', '-W', '2', pingHost ]),
			{ code: 1, stdout: '', stderr: '' }
		));
	}

	return Promise.all([ routeTask ].concat(pingTasks)).then(function(results) {
		var route = results[0];
		var checks = {};

		for (var i = 0; i < sources.length; i++) {
			var res = results[i + 1] || {};
			var output = [ res.stdout || '', res.stderr || '' ].join('\n');
			var latency = /time[=<]([0-9.]+)\s*ms/.exec(output);

			checks[sources[i]] = {
				ok: res.code === 0,
				device: devmap[sources[i]] ? devmap[sources[i]].device : sources[i],
				latency: latency ? latency[1] : ''
			};
		}

		internetCache = {
			checked: Date.now(),
			routed: routeIface(route.stdout),
			checks: checks
		};

		return internetCache;
	});
}

function statusBadge(ok) {
	return E('span', {
		'class': ok ? 'label success' : 'label warning',
		'style': 'display:inline-flex;min-width:4.5em;justify-content:center'
	}, ok ? _('Online') : _('Offline'));
}

function renderSourceTable(sources, devmap, data) {
	var rows = [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th left' }, _('Interface')),
			E('th', { 'class': 'th left' }, _('Device')),
			E('th', { 'class': 'th left' }, _('Internet')),
			E('th', { 'class': 'th left' }, _('Ping'))
		])
	];

	if (!sources.length) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'colspan': '4' },
				E('em', _('No internet interfaces configured in firewall.@zone[1].network')))
		]));
	}

	for (var i = 0; i < sources.length; i++) {
		var src = sources[i];
		var check = data.checks[src] || {};

		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, src),
			E('td', { 'class': 'td left' }, check.device || (devmap[src] ? devmap[src].device : src)),
			E('td', { 'class': 'td left' }, statusBadge(!!check.ok)),
			E('td', { 'class': 'td left' }, check.latency ? _('%s ms').format(check.latency) : '-')
		]));
	}

	return E('table', { 'class': 'table' }, rows);
}

function renderAddControls(ctx, sources, devmap) {
	var qtcmIf = qtcmInterface();
	var candidates = [];
	var candidateMap = {};
	var select;
	var simWrap;
	var simSelect;

	Object.keys(devmap).sort().forEach(function(name) {
		candidateMap[name] = devmap[name].label;
	});

	if (qtcmIf)
		candidateMap[qtcmIf] = _('Cellular (%s)').format(qtcmIf);

	Object.keys(candidateMap).sort().forEach(function(name) {
		if (sources.indexOf(name) == -1)
			candidates.push(E('option', { 'value': name }, candidateMap[name]));
	});

	select = E('select', { 'class': 'cbi-input-select', 'style': 'max-width:20em' }, candidates);
	simSelect = E('select', { 'class': 'cbi-input-select' }, [
		E('option', { 'value': '1', 'selected': activeSimFromConfig() == '1' ? 'selected' : null }, _('SIM 1')),
		E('option', { 'value': '2', 'selected': activeSimFromConfig() == '2' ? 'selected' : null }, _('SIM 2'))
	]);
	simWrap = E('span', {
		'style': 'display:%s;gap:.5rem;align-items:center'.format(qtcmIf && select.value == qtcmIf ? 'inline-flex' : 'none')
	}, [
		E('label', {}, _('via')),
		simSelect
	]);

	select.addEventListener('change', function() {
		simWrap.style.display = qtcmIf && select.value == qtcmIf ? 'inline-flex' : 'none';
	});

	return E('div', {
		'class': 'cbi-page-actions',
		'style': 'display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:flex-start'
	}, [
		E('label', {}, _('Add Internet interface')),
		select,
		qtcmIf ? simWrap : null,
		E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'disabled': candidates.length ? null : 'disabled',
			'click': ui.createHandlerFn(ctx, function() {
				var value = select.value;
				var nextSources;

				if (!value)
					return Promise.resolve();

				nextSources = uniq(sources.concat([ value ]));
				uci.set('firewall', firewallZone, 'network', nextSources);

				if (qtcmIf && value == qtcmIf)
					uci.set('qtcm', 'main', 'active_sim', simSelect.value);

				return uci.save()
					.then(function() { return uci.apply(5); })
					.then(function() {
						internetCache = null;
						ui.addNotification(null, E('p', _('Internet interface added.')));
						return ctx.refreshInternetStatus();
					})
					.catch(function(err) {
						ui.addNotification(null, E('p', _('Unable to add internet interface: %s').format(err.message || err)));
					});
			})
		}, [ _('Add') ])
	]);
}

function renderStatus(ctx, nets, data) {
	var sources = configuredSources();
	var devmap = networkDeviceMap(nets);
	var routed = data.routed || '-';
	var checked = data.checked ? new Date(data.checked).toLocaleString() : '-';

	return E('div', { 'class': 'internet-src-status' }, [
		E('style', {}, [
			'.internet-src-status .internet-src-summary{display:grid;grid-template-columns:14rem minmax(0,1fr);gap:.5rem 1rem;margin:0 0 1rem}',
			'.internet-src-status .internet-src-summary dt{font-weight:700;text-align:right}',
			'.internet-src-status .internet-src-summary dd{margin:0;min-width:0}',
			'@media(max-width:600px){.internet-src-status .internet-src-summary{grid-template-columns:1fr}.internet-src-status .internet-src-summary dt{text-align:left}}'
		]),
		E('dl', { 'class': 'internet-src-summary' }, [
			E('dt', {}, _('Current Routed Internet Interface')),
			E('dd', {}, routed),
			E('dt', {}, _('Configured Internet Sources')),
			E('dd', {}, sources.length ? sources.join(', ') : '-'),
			E('dt', {}, _('Cellular Interface')),
			E('dd', {}, qtcmInterface() || '-'),
			E('dt', {}, _('Cellular SIM')),
			E('dd', {}, simLabel(activeSimFromConfig())),
			E('dt', {}, _('Last Checked')),
			E('dd', {}, checked)
		]),
		renderSourceTable(sources, devmap, data),
		E('div', {
			'class': 'cbi-page-actions',
			'style': 'display:flex;gap:.5rem;align-items:center;flex-wrap:wrap'
		}, [
			E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'click': ui.createHandlerFn(ctx, 'refreshInternetStatus')
			}, [ _('Refresh Internet') ])
		]),
		renderAddControls(ctx, sources, devmap)
	]);
}

return baseclass.extend({
	title: _('Internet'),

	load: function() {
		return Promise.all([
			uci.load('firewall'),
			uci.load('network'),
			uci.load('qtcm').catch(function() {}),
			uci.load('system').catch(function() {}),
			network.getNetworks()
		]).then(function(results) {
			var nets = results[4] || [];
			var sources = configuredSources();
			var devmap = networkDeviceMap(nets);

			if (internetCache)
				return [ nets, internetCache ];

			return runChecks(sources, devmap).then(function(data) {
				return [ nets, data ];
			});
		});
	},

	refreshInternetStatus: function() {
		if (!refreshNode)
			return Promise.resolve();

		dom.content(refreshNode, E('p', {}, E('em', { 'class': 'spinning' }, [ _('Refreshing internet data...') ])));

		return network.getNetworks().then(L.bind(function(nets) {
			var sources = configuredSources();
			var devmap = networkDeviceMap(nets);

			return runChecks(sources, devmap).then(L.bind(function(data) {
				dom.content(refreshNode, renderStatus(this, nets, data));
			}, this));
		}, this)).catch(function(err) {
			dom.content(refreshNode, E('div', { 'class': 'alert-message warning' },
				_('Unable to refresh internet data: %s').format(err.message || err)));
		});
	},

	render: function(result) {
		var nets = result ? result[0] || [] : [];
		var data = result ? result[1] || { routed: '', checks: {} } : { routed: '', checks: {} };

		refreshNode = E('div');
		dom.content(refreshNode, renderStatus(this, nets, data));

		return refreshNode;
	}
});

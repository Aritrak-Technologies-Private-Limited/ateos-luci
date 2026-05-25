'use strict';
'require dom';
'require rpc';
'require ui';
'require view';

var callQtcmStatus = rpc.declare({
	object: 'qtcm',
	method: 'status',
	expect: { '': {} }
});

function serviceStatusText(running) {
	return running ? _('Running') : _('Stopped');
}

function fieldRow(label, value) {
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, label),
		E('div', { 'class': 'cbi-value-field' }, value)
	]);
}

function normalizeStatus(data) {
	return {
		service_running: !!(data && data.service_running),
		at_port: (data && data.at_port) || _('Unknown'),
		interface: (data && data.interface) || _('Unknown'),
		sim_status: (data && data.sim_status) || _('Unknown'),
		network_status: (data && data.network_status) || _('Unknown'),
		network_type: (data && data.network_type) || _('Unknown'),
		band_info: (data && data.band_info) || _('Unknown'),
		provider: (data && data.provider) || _('Unknown'),
		signal_bars: (data && data.signal_bars) || _('Unknown'),
		signal_dbm: (data && data.signal_dbm) || _('Unknown'),
		signal_snr: (data && data.signal_snr) || _('Unknown'),
		signal_text: (data && data.signal_text) || _('Unknown'),
		modem_source: (data && data.modem_source) || _('Unknown'),
		active_sim: (data && data.active_sim) || _('Unknown'),
		sim1_info: (data && data.sim1_info) || _('Unknown'),
		sim2_info: (data && data.sim2_info) || _('Unknown')
	};
}

return view.extend({
	loadStatus: function() {
		return callQtcmStatus().then(function(data) {
			return normalizeStatus(data);
		});
	},

	renderStatus: function(container, data) {
		dom.content(container, [
			fieldRow(_('Service'), serviceStatusText(data.service_running)),
			fieldRow(_('Active SIM'), data.active_sim == '1' ? _('SIM 1') : data.active_sim == '2' ? _('SIM 2') : data.active_sim),
			fieldRow(_('SIM 1'), data.sim1_info),
			fieldRow(_('SIM 2'), data.sim2_info),
			fieldRow(_('AT port'), data.at_port),
			fieldRow(_('SIM connected'), data.sim_status),
			fieldRow(_('Network connected'), data.network_status),
			fieldRow(_('Network type'), data.network_type),
			fieldRow(_('Band'), data.band_info),
			fieldRow(_('Provider'), data.provider),
			fieldRow(_('Signal quality'), '%s (%s, %s dBm)'.format(data.signal_bars, data.signal_text, data.signal_dbm)),
			fieldRow(_('SNR'), data.signal_snr),
			fieldRow(_('Interface'), data.interface),
			fieldRow(_('Data source'), data.modem_source)
		]);
	},

	render: function() {
		var statusNode = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-descr' }, _('Click refresh to fetch the latest modem status.'))
		]);
		var resultNode = E('div', { 'class': 'cbi-section-descr' });
		var self = this;

		function setMessage(text, isError) {
			dom.content(resultNode, E('p', {
				'style': isError ? 'color:#c00;' : ''
			}, text));
		}

		function refreshStatus() {
			setMessage(_('Refreshing status...'), false);

			return self.loadStatus().then(function(data) {
				self.renderStatus(statusNode, data);
				setMessage(_('Status refreshed successfully.'), false);
			}).catch(function(err) {
				dom.content(statusNode, E('div', {
					'class': 'cbi-section-descr',
					'style': 'color:#c00;'
				}, _('Unable to load modem status.')));
				setMessage(err.message || err, true);
			});
		}

		return refreshStatus().then(function() {
			return E('div', { 'class': 'cbi-map' }, [
				E('h2', _('Quectel CM Status')),
				E('div', { 'class': 'cbi-map-descr' },
					_('Review modem status and fetch fresh data with the refresh button.')),
				E('div', { 'class': 'cbi-page-actions' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': ui.createHandlerFn(self, refreshStatus)
					}, [ _('Refresh') ])
				]),
				resultNode,
				statusNode
			]);
		});
	}
});

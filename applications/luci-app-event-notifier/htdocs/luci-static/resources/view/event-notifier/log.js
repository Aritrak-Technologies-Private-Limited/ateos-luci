'use strict';
'require view';
'require fs';
'require poll';
'require ui';

return view.extend({
	loadLog: function() {
		return fs.exec_direct('/usr/libexec/event-notifier-log')
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load event log: %s').format(err.message)));
				return '';
			});
	},

	pollLog: function() {
		var element = document.getElementById('event-notifier-log');

		if (element) {
			return this.loadLog().then(function(log) {
				element.value = log || '';
				element.rows = Math.max(12, (log || '').split(/\n/).length + 1);
			});
		}
	},

	load: function() {
		poll.add(this.pollLog.bind(this));
		return this.loadLog();
	},

	render: function(log) {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Event Log')),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Local event history written by the router-side event-notifier backend.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('textarea', {
					'id': 'event-notifier-log',
					'readonly': 'readonly',
					'wrap': 'off',
					'style': 'width:100%; font-family:monospace',
					'rows': Math.max(12, (log || '').split(/\n/).length + 1)
				}, [ log || '' ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

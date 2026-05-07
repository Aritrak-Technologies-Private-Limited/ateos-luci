'use strict';
'require view';
'require form';

function addApiAuth(section) {
	var o;

	o = section.option(form.Flag, 'enabled', _('Enable'));
	o.default = '0';

	o = section.option(form.Value, 'url', _('API URL'), _('Provider endpoint URL. This follows the same local UCI auth style as OpenWISP: URL, key, and shared secret.'));
	o.datatype = 'url';
	o.placeholder = 'https://provider.example/api/notify';

	o = section.option(form.Value, 'key', _('Key'), _('API key or device key.'));
	o.password = true;

	o = section.option(form.Value, 'shared_secret', _('Shared Secret'), _('Shared secret or API token used by the provider.'));
	o.password = true;

	o = section.option(form.Flag, 'verify_ssl', _('Verify SSL'));
	o.default = '1';

	o = section.option(form.Value, 'connect_timeout', _('Connect Timeout'), _('Value passed to curl --connect-timeout, in seconds.'));
	o.datatype = 'uinteger';
	o.placeholder = '15';

	o = section.option(form.Value, 'max_time', _('Max Time'), _('Value passed to curl --max-time, in seconds.'));
	o.datatype = 'uinteger';
	o.placeholder = '30';
}

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('alert-notifier',
			_('Alert Notifications'),
			_('API-based notification channels. Credentials are stored locally on the router and used directly by the device backend.'));

		s = m.section(form.NamedSection, 'email', 'email_api', _('Email API'));
		addApiAuth(s);

		o = s.option(form.Value, 'from', _('From address'));
		o.datatype = 'email';

		o = s.option(form.DynamicList, 'recipient', _('Recipients'));
		o.datatype = 'email';
		o.placeholder = 'ops@example.com';

		s = m.section(form.NamedSection, 'sms', 'sms_api', _('SMS API'));
		addApiAuth(s);

		o = s.option(form.Value, 'sender', _('Sender ID'));
		o.placeholder = 'Router';

		o = s.option(form.DynamicList, 'recipient', _('Recipients'));
		o.datatype = 'phonedigit';
		o.placeholder = '+15551234567';

		return m.render();
	}
});

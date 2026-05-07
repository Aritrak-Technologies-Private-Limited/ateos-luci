'use strict';

'require view';
'require form';
'require request';
'require uci';
'require ui';

function collectMenuEntries(node, path, entries) {
	if (!node)
		return entries;

	let key = path.join('/');

	if (key && node.title && !node.firstchild_ineligible) {
		entries.push({
			path: key,
			title: node.default_title || node.title
		});
	}

	if (node.children) {
		Object.keys(node.children).sort().forEach(function(name) {
			collectMenuEntries(node.children[name], path.concat(name), entries);
		});
	}

	return entries;
}

function menuLabel(entry) {
	return '%s (%s)'.format(entry.title, entry.path);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('appnames'),
			request.get(L.url('admin/menu')).then(function(res) {
				return res.json();
			})
		]);
	},

	render: function(data) {
		let entries = collectMenuEntries(data[1], [], []);
		let entryByPath = {};
		let m, s, o;

		entries.sort(function(a, b) {
			return L.naturalCompare(a.path, b.path);
		});

		entries.forEach(function(entry) {
			entryByPath[entry.path] = entry;
		});

		m = new form.Map('appnames', _('Display Names'),
			_('Override LuCI menu labels without changing the installed applications.'));

		s = m.section(form.GridSection, 'rename');
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.option(form.ListValue, 'path', _('Menu entry'));
		o.rmempty = false;

		entries.forEach(function(entry) {
			o.value(entry.path, menuLabel(entry));
		});

		o.cfgvalue = function(section_id) {
			let value = uci.get('appnames', section_id, 'path');

			if (value && !entryByPath[value])
				this.value(value, value);

			return value;
		};

		o.validate = function(section_id, value) {
			if (!value)
				return _('Select a menu entry.');

			let duplicate = false;

			uci.sections('appnames', 'rename', function(s) {
				if (s['.name'] != section_id && s.path == value)
					duplicate = true;
			});

			return duplicate ? _('This menu entry already has an override.') : true;
		};

		o = s.option(form.DummyValue, '_default_title', _('Default name'));
		o.cfgvalue = function(section_id) {
			let path = uci.get('appnames', section_id, 'path');

			return entryByPath[path] ? entryByPath[path].title : '-';
		};

		o = s.option(form.Value, 'title', _('Display name'));
		o.rmempty = false;
		o.validate = function(section_id, value) {
			value = (value || '').trim();

			if (!value)
				return _('Enter a display name.');

			if (value.length > 80)
				return _('The display name is too long.');

			return true;
		};

		return m.render();
	},

	handleSave: function(ev) {
		return this.super('handleSave', [ev]).then(function() {
			if (ui.menu && ui.menu.flushCache)
				ui.menu.flushCache();
		});
	},

	handleSaveApply: function(ev, mode) {
		if (ui.menu && ui.menu.flushCache)
			ui.menu.flushCache();

		return this.super('handleSaveApply', [ev, mode]);
	}
});

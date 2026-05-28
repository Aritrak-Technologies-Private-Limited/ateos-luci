'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';

function addRouteMapValues(o) {
	var sections = uci.sections('frr_bgpd', 'route_map');

	for (var i = 0; i < sections.length; i++) {
		var name = sections[i].name;
		if (name)
			o.value(name);
	}
}

function addPrefixListValues(o) {
	var sections = uci.sections('frr_bgpd', 'prefix_list');

	for (var i = 0; i < sections.length; i++) {
		var name = sections[i].name;
		if (name)
			o.value(name);
	}
}

function addPeerGroupValues(o) {
	var sections = uci.sections('frr_bgpd', 'peer_group');

	for (var i = 0; i < sections.length; i++) {
		var name = sections[i].name;
		if (name)
			o.value(name);
	}
}

function addAsPathListValues(o) {
	var sections = uci.sections('frr_bgpd', 'as_path_list');

	for (var i = 0; i < sections.length; i++) {
		var name = sections[i].name;
		if (name)
			o.value(name);
	}
}

function addCommunityListValues(o, large) {
	var sections = uci.sections('frr_bgpd', 'community_list');

	for (var i = 0; i < sections.length; i++) {
		var name = sections[i].name;
		if (name && ((sections[i].large === '1') === !!large))
			o.value(name);
	}
}

function runHelper(args, message) {
	return fs.exec('/usr/libexec/luci-frr-bgpd', args).then(function(res) {
		if (res.code !== 0)
			throw new Error(res.stderr || res.stdout || _('Command failed.'));

		ui.addNotification(null, E('pre', { 'style': 'white-space: pre-wrap' }, res.stdout || message), 'info');
	}).catch(function(e) {
		ui.addNotification(null, E('p', {}, e.message), 'danger');
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/usr/libexec/luci-frr-bgpd', [ 'status' ]), _('Status command failed or is not available.')),
			L.resolveDefault(fs.exec_direct('/usr/libexec/luci-frr-bgpd', [ 'preview' ]), _('Preview command failed or is not available.')),
			uci.load('frr_bgpd')
		]);
	},

	render: function(data) {
		var status = data[0];
		var preview = data[1];
		var m, s, o;

		m = new form.Map('frr_bgpd', _('FRR BGP'),
			_('Configure FRRouting bgpd for IPv4/IPv6 BGP peering, route advertisement, filtering and ECMP. This UI writes /etc/frr/frr.conf and enables zebra/bgpd in /etc/frr/daemons when applied.') +
			'<br />' +
			_('Allowed capabilities: eBGP/iBGP neighbors, peer groups, BFD, VRF/table targeting, IPv4/IPv6 address families, advertised networks, aggregate routes, connected/static/kernel redistribution, route maps, prefix/as-path/community lists, next-hop-self, route-reflector client, default-originate, soft reconfiguration, send-community, remove-private-AS, AS override, maximum-prefix, graceful restart and ECMP via maximum-paths plus multipath-relax.'));
		m.tabbed = true;

		s = m.section(form.NamedSection, 'global', 'bgpd', _('BGP Daemon'));
		s.addremove = false;
		s.tab('basic', _('Basic Settings'));
		s.tab('ecmp', _('ECMP'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('actions', _('Apply & Status'));

		o = s.taboption('basic', form.Flag, 'enabled', _('Enable BGP configuration'));
		o.default = o.disabled;

		o = s.taboption('basic', form.Value, 'hostname', _('Hostname'));
		o.placeholder = 'OpenWrt';
		o.datatype = 'hostname';

		o = s.taboption('basic', form.Value, 'local_as', _('Local AS'));
		o.rmempty = false;
		o.datatype = 'range(1, 4294967295)';
		o.placeholder = '65001';

		o = s.taboption('basic', form.Value, 'vrf', _('VRF'));
		o.placeholder = 'blue';
		o.datatype = 'uciname';

		o = s.taboption('basic', form.Value, 'kernel_table', _('Kernel table'),
			_('Optional FRR table for BGP routes. Coordinate this with pbr/mwan3 rules if used.'));
		o.datatype = 'uinteger';
		o.placeholder = '100';

		o = s.taboption('basic', form.Value, 'router_id', _('Router ID'));
		o.datatype = 'ip4addr';
		o.placeholder = '192.0.2.1';

		o = s.taboption('basic', form.ListValue, 'log_level', _('Log level'));
		o.value('emerg');
		o.value('alert');
		o.value('crit');
		o.value('err');
		o.value('warning');
		o.value('notice');
		o.value('informational');
		o.value('debugging');
		o.default = 'informational';

		o = s.taboption('basic', form.Flag, 'ipv4_unicast', _('IPv4 unicast'));
		o.default = o.enabled;

		o = s.taboption('basic', form.Flag, 'ipv6_unicast', _('IPv6 unicast'));
		o.default = o.disabled;

		o = s.taboption('basic', form.Flag, 'default_ipv4', _('Default IPv4 neighbor activation'),
			_('Leave enabled for classic FRR behavior. Disable to require explicit address-family activation only.'));
		o.default = o.enabled;

		o = s.taboption('basic', form.Flag, 'network_import_check', _('Network import check'),
			_('Require advertised network prefixes to exist in the routing table. Disable only when you intentionally originate routes another way.'));
		o.default = o.enabled;

		o = s.taboption('basic', form.Flag, 'log_neighbor_changes', _('Log neighbor changes'));
		o.default = o.enabled;

		o = s.taboption('ecmp', form.Flag, 'ecmp', _('Enable ECMP'),
			_('Installs multiple equal-cost BGP paths when FRR and the kernel can use them.'));
		o.default = o.disabled;

		o = s.taboption('ecmp', form.Value, 'maximum_paths', _('Maximum eBGP paths'),
			_('FRR maximum-paths value for external BGP paths.'));
		o.datatype = 'range(1, 64)';
		o.placeholder = '2';
		o.depends('ecmp', '1');

		o = s.taboption('ecmp', form.Value, 'maximum_paths_ibgp', _('Maximum iBGP paths'),
			_('FRR maximum-paths ibgp value for internal BGP paths.'));
		o.datatype = 'range(1, 64)';
		o.placeholder = '2';
		o.depends('ecmp', '1');

		o = s.taboption('ecmp', form.Flag, 'multipath_relax', _('Relax AS path check'),
			_('Allows multipath between paths with different AS paths when the usual BGP selection rules otherwise allow it.'));
		o.default = o.disabled;
		o.depends('ecmp', '1');

		o = s.taboption('ecmp', form.Flag, 'compare_routerid', _('Compare router ID'),
			_('Include router ID comparison in best-path selection.'));
		o.default = o.disabled;

		o = s.taboption('advanced', form.Value, 'timers', _('BGP timers'),
			_('Keepalive and hold time, for example: 10 30.'));
		o.datatype = 'string';
		o.placeholder = '10 30';

		o = s.taboption('advanced', form.Flag, 'graceful_restart', _('Graceful restart'));
		o.default = o.disabled;

		o = s.taboption('advanced', form.Flag, 'backup_on_apply', _('Backup existing FRR config'),
			_('Copy /etc/frr/frr.conf to /etc/frr/frr.conf.luci-bak before replacing it.'));
		o.default = o.enabled;

		o = s.taboption('advanced', form.Flag, 'redistribute_connected', _('Redistribute connected'));
		o.default = o.disabled;

		o = s.taboption('advanced', form.Flag, 'redistribute_static', _('Redistribute static'));
		o.default = o.disabled;

		o = s.taboption('advanced', form.Flag, 'redistribute_kernel', _('Redistribute kernel'));
		o.default = o.disabled;

		o = s.taboption('actions', form.Button, '_apply', _('Generate and restart FRR'),
			_('Saves this LuCI configuration, writes /etc/frr/frr.conf, enables zebra/bgpd and restarts the FRR service.'));
		o.inputstyle = 'apply';
		o.inputtitle = _('Save & Apply FRR');
		o.onclick = function() {
			return m.save().then(function() {
				return fs.exec('/usr/libexec/luci-frr-bgpd', [ 'apply' ]);
			}).then(function(res) {
				if (res.code !== 0)
					throw new Error(res.stderr || res.stdout || _('Failed to apply FRR BGP configuration.'));

				ui.addNotification(null, E('pre', {}, res.stdout || _('FRR BGP configuration applied.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', {}, e.message), 'danger');
			});
		};

		o = s.taboption('actions', form.Value, 'action_neighbor', _('Action neighbor'));
		o.placeholder = 'all';
		o.rmempty = true;

		o = s.taboption('actions', form.ListValue, 'action_afi', _('Action address family'));
		o.value('all', _('All'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.default = 'all';

		o = s.taboption('actions', form.Button, '_neighbor_detail', _('Show neighbor'));
		o.inputstyle = 'action';
		o.onclick = function() {
			return m.save().then(function() {
				var neighbor = uci.get('frr_bgpd', 'global', 'action_neighbor') || 'all';
				return runHelper([ 'neighbor', neighbor ], _('Neighbor details loaded.'));
			});
		};

		o = s.taboption('actions', form.Button, '_clear', _('Clear BGP'));
		o.inputstyle = 'reset';
		o.onclick = function() {
			return m.save().then(function() {
				var neighbor = uci.get('frr_bgpd', 'global', 'action_neighbor') || 'all';
				var afi = uci.get('frr_bgpd', 'global', 'action_afi') || 'all';
				return runHelper([ 'clear', neighbor, afi ], _('BGP clear requested.'));
			});
		};

		o = s.taboption('actions', form.Button, '_soft_in', _('Soft reset inbound'));
		o.inputstyle = 'reload';
		o.onclick = function() {
			return m.save().then(function() {
				var neighbor = uci.get('frr_bgpd', 'global', 'action_neighbor') || 'all';
				var afi = uci.get('frr_bgpd', 'global', 'action_afi') || 'all';
				return runHelper([ 'soft-in', neighbor, afi ], _('BGP soft inbound reset requested.'));
			});
		};

		o = s.taboption('actions', form.Button, '_soft_out', _('Soft reset outbound'));
		o.inputstyle = 'reload';
		o.onclick = function() {
			return m.save().then(function() {
				var neighbor = uci.get('frr_bgpd', 'global', 'action_neighbor') || 'all';
				var afi = uci.get('frr_bgpd', 'global', 'action_afi') || 'all';
				return runHelper([ 'soft-out', neighbor, afi ], _('BGP soft outbound reset requested.'));
			});
		};

		o = s.taboption('actions', form.DummyValue, '_preview', _('Generated config preview'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('pre', { 'style': 'white-space: pre-wrap' }, preview || _('No preview output.'));
		};

		o = s.taboption('actions', form.DummyValue, '_status', _('Current status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('pre', { 'style': 'white-space: pre-wrap' }, status || _('No status output.'));
		};

		s = m.section(form.GridSection, 'peer_group', _('Peer Groups'),
			_('Define common neighbor settings once and attach multiple neighbors to the group.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.datatype = 'uciname';

		o = s.option(form.Value, 'remote_as', _('Remote AS'));
		o.datatype = 'range(1, 4294967295)';

		o = s.option(form.Value, 'description', _('Description'));
		o.modalonly = true;

		o = s.option(form.Value, 'update_source', _('Update source'));
		o.modalonly = true;

		o = s.option(form.Value, 'ebgp_multihop', _('eBGP multihop'));
		o.modalonly = true;
		o.datatype = 'range(1, 255)';

		o = s.option(form.Value, 'password', _('Password'));
		o.modalonly = true;
		o.password = true;

		o = s.option(form.Value, 'local_as', _('Local AS override'));
		o.modalonly = true;
		o.datatype = 'range(1, 4294967295)';

		o = s.option(form.Value, 'timers', _('Timers'));
		o.modalonly = true;
		o.placeholder = '10 30';

		s = m.section(form.GridSection, 'neighbor', _('Neighbors'),
			_('Create eBGP or iBGP peers. Activate a neighbor for IPv4, IPv6 or both address families, then optionally attach route maps and policy controls.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.datatype = 'uciname';

		o = s.option(form.Value, 'address', _('Peer address'));
		o.rmempty = false;
		o.datatype = 'or(ipaddr,host)';
		o.placeholder = '203.0.113.1';

		o = s.option(form.Value, 'remote_as', _('Remote AS'));
		o.datatype = 'range(1, 4294967295)';
		o.placeholder = '65000';

		o = s.option(form.ListValue, 'peer_group', _('Peer group'));
		o.value('', _('-- None --'));
		addPeerGroupValues(o);

		o = s.option(form.ListValue, 'afi', _('Address families'));
		o.value('both', _('IPv4 and IPv6'));
		o.value('ipv4', _('IPv4 only'));
		o.value('ipv6', _('IPv6 only'));
		o.default = 'both';

		o = s.option(form.Value, 'description', _('Description'));
		o.modalonly = true;

		o = s.option(form.Value, 'update_source', _('Update source'));
		o.modalonly = true;
		o.placeholder = 'loopback';

		o = s.option(form.Value, 'ebgp_multihop', _('eBGP multihop'));
		o.modalonly = true;
		o.datatype = 'range(1, 255)';

		o = s.option(form.Value, 'password', _('Password'));
		o.modalonly = true;
		o.password = true;

		o = s.option(form.Value, 'local_as', _('Neighbor local AS'));
		o.modalonly = true;
		o.datatype = 'range(1, 4294967295)';

		o = s.option(form.Value, 'timers', _('Neighbor timers'));
		o.modalonly = true;
		o.placeholder = '10 30';

		o = s.option(form.Flag, 'next_hop_self', _('Next hop self'));
		o.modalonly = true;
		o.default = o.disabled;

		o = s.option(form.Flag, 'soft_reconfiguration', _('Soft reconfiguration inbound'));
		o.modalonly = true;
		o.default = o.enabled;

		o = s.option(form.Flag, 'default_originate', _('Default originate'));
		o.modalonly = true;
		o.default = o.disabled;

		o = s.option(form.Flag, 'route_reflector_client', _('Route reflector client'));
		o.modalonly = true;
		o.default = o.disabled;

		o = s.option(form.Flag, 'remove_private_as', _('Remove private AS'));
		o.modalonly = true;
		o.default = o.disabled;

		o = s.option(form.Flag, 'as_override', _('AS override'));
		o.modalonly = true;
		o.default = o.disabled;

		o = s.option(form.Value, 'maximum_prefix', _('Maximum prefix'));
		o.modalonly = true;
		o.datatype = 'uinteger';
		o.placeholder = '1000';

		o = s.option(form.Value, 'allowas_in', _('Allow own AS in path'));
		o.modalonly = true;
		o.datatype = 'range(1, 10)';
		o.placeholder = '1';

		o = s.option(form.Flag, 'bfd', _('BFD'));
		o.modalonly = true;
		o.default = o.disabled;

		o = s.option(form.ListValue, 'send_community', _('Send community'));
		o.modalonly = true;
		o.value('none', _('Disabled'));
		o.value('standard', _('Standard'));
		o.value('extended', _('Extended'));
		o.value('large', _('Large'));
		o.value('both', _('Standard and extended'));
		o.default = 'both';

		o = s.option(form.ListValue, 'route_map_in', _('Inbound route map'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addRouteMapValues(o);

		o = s.option(form.ListValue, 'route_map_out', _('Outbound route map'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addRouteMapValues(o);

		o = s.option(form.ListValue, 'route_map_in_v4', _('IPv4 inbound route map'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addRouteMapValues(o);

		o = s.option(form.ListValue, 'route_map_out_v4', _('IPv4 outbound route map'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addRouteMapValues(o);

		o = s.option(form.ListValue, 'route_map_in_v6', _('IPv6 inbound route map'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addRouteMapValues(o);

		o = s.option(form.ListValue, 'route_map_out_v6', _('IPv6 outbound route map'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addRouteMapValues(o);

		o = s.option(form.Value, 'maximum_prefix_v4', _('IPv4 maximum prefix'));
		o.modalonly = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'maximum_prefix_v6', _('IPv6 maximum prefix'));
		o.modalonly = true;
		o.datatype = 'uinteger';

		s = m.section(form.GridSection, 'network', _('Advertised Networks'),
			_('Advertise local prefixes with BGP network statements. The prefix must already exist in the routing table unless another FRR policy creates it.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'prefix', _('Prefix'));
		o.rmempty = false;
		o.datatype = 'cidr';
		o.placeholder = '198.51.100.0/24';

		o = s.option(form.ListValue, 'afi', _('Address family'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.default = 'ipv4';

		o = s.option(form.ListValue, 'route_map', _('Route map'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addRouteMapValues(o);

		s = m.section(form.GridSection, 'aggregate', _('Aggregate Routes'),
			_('Advertise summarized routes using aggregate-address. Use summary-only to suppress more specific routes where appropriate.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'prefix', _('Prefix'));
		o.rmempty = false;
		o.datatype = 'cidr';
		o.placeholder = '198.51.100.0/22';

		o = s.option(form.ListValue, 'afi', _('Address family'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.default = 'ipv4';

		o = s.option(form.Flag, 'summary_only', _('Summary only'));
		o.default = o.disabled;

		o = s.option(form.Flag, 'as_set', _('AS set'));
		o.modalonly = true;
		o.default = o.disabled;

		s = m.section(form.GridSection, 'prefix_list', _('Prefix Lists'),
			_('Define reusable IPv4 or IPv6 prefix filters for route maps.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.datatype = 'uciname';

		o = s.option(form.ListValue, 'afi', _('Address family'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.default = 'ipv4';

		o = s.option(form.Value, 'seq', _('Sequence'));
		o.datatype = 'uinteger';
		o.placeholder = '10';

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('permit', _('Permit'));
		o.value('deny', _('Deny'));
		o.default = 'permit';

		o = s.option(form.Value, 'prefix', _('Prefix'));
		o.rmempty = false;
		o.datatype = 'cidr';
		o.placeholder = '198.51.100.0/24';

		o = s.option(form.Value, 'ge', _('GE'));
		o.modalonly = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'le', _('LE'));
		o.modalonly = true;
		o.datatype = 'uinteger';

		s = m.section(form.GridSection, 'as_path_list', _('AS Path Lists'),
			_('Match AS paths in route maps using regular expressions.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.datatype = 'uciname';

		o = s.option(form.Value, 'seq', _('Sequence'));
		o.datatype = 'uinteger';

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('permit', _('Permit'));
		o.value('deny', _('Deny'));
		o.default = 'permit';

		o = s.option(form.Value, 'regex', _('Regex'));
		o.rmempty = false;
		o.placeholder = '^65000_';

		s = m.section(form.GridSection, 'community_list', _('Community Lists'),
			_('Match standard, expanded or large BGP communities in route maps.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.datatype = 'uciname';

		o = s.option(form.Flag, 'large', _('Large community'));
		o.default = o.disabled;

		o = s.option(form.ListValue, 'type', _('Type'));
		o.value('standard', _('Standard'));
		o.value('expanded', _('Expanded'));
		o.default = 'standard';

		o = s.option(form.Value, 'seq', _('Sequence'));
		o.datatype = 'uinteger';

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('permit', _('Permit'));
		o.value('deny', _('Deny'));
		o.default = 'permit';

		o = s.option(form.Value, 'community', _('Community'));
		o.rmempty = false;
		o.placeholder = '65001:100';

		s = m.section(form.GridSection, 'route_map', _('Route Maps'),
			_('Attach route maps to neighbors or network statements to filter or modify BGP attributes.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.datatype = 'uciname';

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('permit', _('Permit'));
		o.value('deny', _('Deny'));
		o.default = 'permit';

		o = s.option(form.Value, 'seq', _('Sequence'));
		o.datatype = 'uinteger';
		o.placeholder = '10';

		o = s.option(form.ListValue, 'afi', _('Prefix-list family'));
		o.modalonly = true;
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.default = 'ipv4';

		o = s.option(form.ListValue, 'match_prefix_list', _('Match prefix list'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addPrefixListValues(o);

		o = s.option(form.ListValue, 'match_as_path', _('Match AS path list'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addAsPathListValues(o);

		o = s.option(form.ListValue, 'match_community', _('Match community list'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addCommunityListValues(o, false);

		o = s.option(form.ListValue, 'match_large_community', _('Match large community list'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		addCommunityListValues(o, true);

		o = s.option(form.Value, 'set_local_pref', _('Set local preference'));
		o.modalonly = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'set_metric', _('Set metric'));
		o.modalonly = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'set_weight', _('Set weight'));
		o.modalonly = true;
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'set_community', _('Set community'));
		o.modalonly = true;
		o.placeholder = '65001:100 additive';

		o = s.option(form.Value, 'set_large_community', _('Set large community'));
		o.modalonly = true;
		o.placeholder = '65001:100:1 additive';

		o = s.option(form.Value, 'set_extcommunity_rt', _('Set route-target'));
		o.modalonly = true;
		o.placeholder = '65001:100';

		o = s.option(form.Value, 'set_as_path_prepend', _('Prepend AS path'));
		o.modalonly = true;
		o.placeholder = '65001 65001';

		o = s.option(form.ListValue, 'set_origin', _('Set origin'));
		o.modalonly = true;
		o.value('', _('-- Please choose --'));
		o.value('igp', 'igp');
		o.value('egp', 'egp');
		o.value('incomplete', 'incomplete');

		o = s.option(form.Value, 'set_next_hop', _('Set next hop'));
		o.modalonly = true;
		o.datatype = 'ipaddr';

		return m.render();
	}
});

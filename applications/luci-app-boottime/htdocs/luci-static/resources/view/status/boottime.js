'use strict';
'require view';
'require fs';

const CATEGORY_RULES = [
	{ name: _('Boot core'), key: 'core', re: /\b(init|procd|preinit|mount_root|jffs2|overlay|urngd|console)\b/i },
	{ name: _('Network'), key: 'network', re: /\b(netifd|interface|dhcp|udhcpc|odhcp|dnsmasq|wan|wwan|lan|route)\b/i },
	{ name: _('Wireless'), key: 'wireless', re: /\b(wifi|wlan|hostapd|wpa_supplicant|phy\d|radio|associated|deauthenticated)\b/i },
	{ name: _('DNS / DoH'), key: 'dns', re: /\b(doh|https-dns-proxy|dns|resolver|stubby|smartdns|adguard)\b/i },
	{ name: _('Routing'), key: 'routing', re: /\b(frr|zebra|staticd|bgpd|ospfd|babeld|bird|mwan3)\b/i },
	{ name: _('VPN'), key: 'vpn', re: /\b(openvpn|ipsec|strongswan|swanctl|wireguard|wg|xl2tpd|ocserv)\b/i },
	{ name: _('Storage'), key: 'storage', re: /\b(block|fstab|mount|ext4|f2fs|ubi|ubifs|mmc|sda|usb-storage)\b/i },
	{ name: _('Errors'), key: 'errors', re: /\b(error|failed|failure|crash loop|cannot|timeout|refused|denied|not found|unreachable)\b/i },
	{ name: _('Other'), key: 'other', re: /.*/ }
];

const MILESTONES = [
	{ name: _('Console alive'), re: /Console is alive/i },
	{ name: _('Root mounted'), re: /mount_root.*(complete|done)|rootfs_data|switching to.*overlay/i },
	{ name: _('Procd init'), re: /procd.*init|init:.*- procd/i },
	{ name: _('Kernel modules done'), re: /kmodloader.*done|modules.*done/i },
	{ name: _('LAN starts'), re: /Interface 'lan' is enabled|interface lan.*up|lan.*link is up/i },
	{ name: _('WAN starts'), re: /Interface 'wan' is enabled|interface wan.*up|wwan.*up|udhcpc.*lease/i },
	{ name: _('WiFi ready'), re: /associated|AP-ENABLED|wlan\d: link becomes ready|phy\d.*configured/i },
	{ name: _('Random generator'), re: /urngd.*started/i },
	{ name: _('Init complete'), re: /init complete/i }
];

function fmtSeconds(sec) {
	if (sec == null || isNaN(sec))
		return '-';

	if (sec < 1)
		return '%.0f ms'.format(sec * 1000);

	return '%.2f s'.format(sec);
}

function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineTime(line, lastKernelTime) {
	const m = line.match(/\[\s*([0-9]+(?:\.[0-9]+)?)\]/);

	if (m)
		return +m[1];

	return lastKernelTime;
}

function wallClock(line) {
	const m = line.match(/^([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+/);

	return m ? m[1] : '-';
}

function shortLine(line) {
	if (!line)
		return '-';

	line = line.replace(/^\s*<\d+>/, '').trim();

	return line.length > 180 ? line.substring(0, 177) + '...' : line;
}

function serviceName(rcName) {
	return rcName.replace(/^S\d+/, '');
}

function parseRcList(output) {
	return output.split(/\n/).map(function(line) {
		line = line.trim();

		if (!/^S\d+/.test(line))
			return null;

		return {
			rc: line,
			order: +(line.match(/^S(\d+)/) || [ 0, 0 ])[1],
			name: serviceName(line)
		};
	}).filter(Boolean).sort(function(a, b) {
		if (a.order !== b.order)
			return a.order - b.order;

		return a.rc > b.rc ? 1 : -1;
	});
}

function categorize(line) {
	for (let i = 0; i < CATEGORY_RULES.length; i++)
		if (CATEGORY_RULES[i].re.test(line))
			return CATEGORY_RULES[i];

	return CATEGORY_RULES[CATEGORY_RULES.length - 1];
}

function parseLogs(syslog, dmesg, services) {
	const seen = {};
	const lines = [];
	let lastKernelTime = null;

	for (const line of (syslog + '\n' + dmesg).split(/\n/)) {
		const text = line.trim();

		if (!text || seen[text])
			continue;

		seen[text] = true;

		const directKernel = text.match(/\[\s*([0-9]+(?:\.[0-9]+)?)\]/);

		if (directKernel)
			lastKernelTime = +directKernel[1];

		lines.push({
			text,
			time: lineTime(text, lastKernelTime),
			wall: wallClock(text),
			category: categorize(text)
		});
	}

	const milestones = [];

	for (const milestone of MILESTONES) {
		const entry = lines.find(function(line) {
			return milestone.re.test(line.text);
		});

		if (entry)
			milestones.push({
				name: milestone.name,
				time: entry.time,
				wall: entry.wall,
				line: entry.text
			});
	}

	milestones.sort(function(a, b) {
		return (a.time == null ? 1e12 : a.time) - (b.time == null ? 1e12 : b.time);
	});

	const profile = {};

	for (const line of lines) {
		const m = line.text.match(/BOOTPROFILE\s+(S\d+\S*)\s+([0-9]+)\s+sec/i);

		if (m)
			profile[m[1]] = +m[2];
	}

	const serviceRows = services.map(function(service) {
		const nameRe = new RegExp('(^|[^a-z0-9_-])' + escapeRegExp(service.name) + '([^a-z0-9_-]|$)', 'i');
		const rcRe = new RegExp(escapeRegExp(service.rc), 'i');
		const first = lines.find(function(line) {
			return nameRe.test(line.text) || rcRe.test(line.text);
		});
		const problemCount = lines.filter(function(line) {
			return (nameRe.test(line.text) || rcRe.test(line.text)) && CATEGORY_RULES[7].re.test(line.text);
		}).length;

		return {
			rc: service.rc,
			name: service.name,
			order: service.order,
			time: first ? first.time : null,
			wall: first ? first.wall : '-',
			duration: profile[service.rc],
			problemCount,
			line: first ? first.text : ''
		};
	});

	const observed = serviceRows.filter(function(row) {
		return row.time != null;
	}).sort(function(a, b) {
		return a.time - b.time;
	});

	for (let i = 0; i < observed.length; i++)
		if (observed[i].duration == null && observed[i + 1])
			observed[i].gap = Math.max(0, observed[i + 1].time - observed[i].time);

	const categories = CATEGORY_RULES.map(function(rule) {
		const categoryLines = lines.filter(function(line) {
			return line.category.key === rule.key;
		});
		const first = categoryLines.find(function(line) {
			return line.time != null;
		});
		const errors = categoryLines.filter(function(line) {
			return CATEGORY_RULES[7].re.test(line.text);
		}).length;

		return {
			name: rule.name,
			count: categoryLines.length,
			errors,
			first: first ? first.time : null,
			samples: categoryLines.slice(0, 8)
		};
	}).filter(function(row) {
		return row.count > 0;
	});

	const issues = lines.filter(function(line) {
		return CATEGORY_RULES[7].re.test(line.text);
	}).slice(0, 80);

	return {
		lines,
		milestones,
		services: serviceRows,
		categories,
		issues
	};
}

function table(headers, rows, emptyText) {
	const t = E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr table-titles' }, headers.map(function(header) {
			return E('th', { 'class': 'th' }, header);
		}))
	]);

	cbi_update_table(t, rows, E('em', emptyText || _('No information available')));

	return t;
}

function statusBadge(text, type) {
	return E('span', {
		'class': 'ifacebadge',
		'style': type === 'bad' ? 'border-color:#d33;color:#d33' : ''
	}, text);
}

function serviceDuration(row) {
	if (row.duration != null)
		return row.duration;

	return row.gap;
}

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/sbin/logread'), ''),
			L.resolveDefault(fs.exec_direct('/bin/dmesg', [ '-r' ]), ''),
			L.resolveDefault(fs.exec_direct('/bin/ls', [ '/etc/rc.d' ]), '')
		]);
	},

	render(data) {
		const syslog = data[0] || '';
		const dmesg = data[1] || '';
		const services = parseRcList(data[2] || '');
		const parsed = parseLogs(syslog, dmesg, services);
		const bootComplete = parsed.milestones.find(function(row) {
			return row.name === _('Init complete');
		}) || parsed.milestones[parsed.milestones.length - 1];
		const profiled = parsed.services.filter(function(row) {
			return row.duration != null;
		}).length;
		const slowServices = parsed.services.filter(function(row) {
			return serviceDuration(row) != null;
		}).sort(function(a, b) {
			return serviceDuration(b) - serviceDuration(a);
		}).slice(0, 8);

		return E([], [
			E('h2', _('Boot Time')),
			E('div', { 'class': 'cbi-map-descr' },
				_('This page extracts boot milestones, groups log messages by subsystem, and correlates startup services with the first matching boot log entry. Exact service duration is shown when BOOTPROFILE log entries are present.')),

			E('div', {
				'style': 'display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:.75rem;margin:1rem 0'
			}, [
				E('div', { 'class': 'cbi-section', 'style': 'margin:0;padding:.75rem' }, [
					E('strong', _('Init complete')),
					E('div', { 'style': 'font-size:1.6rem;margin-top:.35rem' }, fmtSeconds(bootComplete ? bootComplete.time : null))
				]),
				E('div', { 'class': 'cbi-section', 'style': 'margin:0;padding:.75rem' }, [
					E('strong', _('Startup services')),
					E('div', { 'style': 'font-size:1.6rem;margin-top:.35rem' }, '%d'.format(services.length))
				]),
				E('div', { 'class': 'cbi-section', 'style': 'margin:0;padding:.75rem' }, [
					E('strong', _('Profiled services')),
					E('div', { 'style': 'font-size:1.6rem;margin-top:.35rem' }, '%d'.format(profiled))
				]),
				E('div', { 'class': 'cbi-section', 'style': 'margin:0;padding:.75rem' }, [
					E('strong', _('Problem log lines')),
					E('div', { 'style': 'font-size:1.6rem;margin-top:.35rem' }, '%d'.format(parsed.issues.length))
				])
			]),

			E('h3', _('Boot milestones')),
			table([
				_('Time after boot'),
				_('Wall time'),
				_('Milestone'),
				_('Evidence')
			], parsed.milestones.map(function(row) {
				return [ fmtSeconds(row.time), row.wall, row.name, shortLine(row.line) ];
			}), _('No boot milestones found in the current logs.')),

			E('h3', _('Slowest startup apps')),
			table([
				_('RC script'),
				_('App'),
				_('Time'),
				_('Source'),
				_('Issues')
			], slowServices.map(function(row) {
				return [
					row.rc,
					row.name,
					fmtSeconds(serviceDuration(row)),
					row.duration != null ? _('BOOTPROFILE') : _('gap until next observed service'),
					row.problemCount ? statusBadge('%d'.format(row.problemCount), 'bad') : '-'
				];
			}), _('No startup timing hints found.')),

			E('h3', _('Startup app timing')),
			table([
				_('RC script'),
				_('App'),
				_('First log at'),
				_('Duration'),
				_('Issues'),
				_('Evidence')
			], parsed.services.map(function(row) {
				const duration = row.duration != null
					? fmtSeconds(row.duration)
					: (row.gap != null ? _('next log gap: %s').format(fmtSeconds(row.gap)) : '-');

				return [
					row.rc,
					row.name,
					fmtSeconds(row.time),
					duration,
					row.problemCount ? statusBadge('%d'.format(row.problemCount), 'bad') : '-',
					shortLine(row.line)
				];
			}), _('No startup scripts found in /etc/rc.d.')),

			E('h3', _('Log categories')),
			table([
				_('Category'),
				_('Lines'),
				_('First seen'),
				_('Errors'),
				_('Sample')
			], parsed.categories.map(function(row) {
				return [
					row.name,
					'%d'.format(row.count),
					fmtSeconds(row.first),
					row.errors ? statusBadge('%d'.format(row.errors), 'bad') : '-',
					row.samples.map(function(line) {
						return shortLine(line.text);
					}).join('\n')
				];
			}), _('No logs available.')),

			E('h3', _('Boot problems')),
			table([
				_('Time after boot'),
				_('Category'),
				_('Log line')
			], parsed.issues.map(function(line) {
				return [
					fmtSeconds(line.time),
					line.category.name,
					shortLine(line.text)
				];
			}), _('No error, failure, timeout, or crash-loop lines found.'))
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

export function getConfigFields() {
	return [
		{
			type: 'textinput',
			id: 'deviceAddress',
			label: 'Device IP / FQDN',
			width: 6,
			default: '',
		},
		{
			type: 'number',
			id: 'poll_interval',
			label: 'Status polling interval (ms)',
			tooltip:
				'The matrix does not report changes on its own, so all state comes from polling. The stock web UI polls every 1000ms.',
			min: 500,
			max: 300000,
			default: 2000,
			width: 6,
		},
		{
			id: 'security-note',
			type: 'static-text',
			label: 'Security',
			width: 12,
			value:
				'This matrix has no working access control. It serves every stored username and password in plaintext to any client that can reach it over HTTP, and its own login page is enforced only in the browser. Keep it on a management VLAN and do not reuse its credentials elsewhere.',
		},
	]
}

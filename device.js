import got from 'got'

const REQUEST_TIMEOUT = 4000

/** Accept `1.2.3.4`, `http://1.2.3.4` or `http://1.2.3.4/` alike. */
export const normaliseAddress = (address) => {
	const trimmed = (address ?? '').trim().replace(/\/+$/, '')
	return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

/**
 * The cache-buster concatenates straight onto the path with no `?` — the
 * firmware prefix-matches the route, and a query string is not stripped.
 */
export const statusUrl = (baseUrl, now = Date.now()) => `${baseUrl}/all_dat.get${now}`

/** Commands are `#`-prefixed and concatenated with no separator between them. */
export const commandBody = (commands) => commands.map((command) => `#${command}`).join('')

export async function fetchStatus(baseUrl) {
	const response = await got.get(statusUrl(baseUrl), {
		retry: { limit: 0 },
		timeout: { request: REQUEST_TIMEOUT },
	})
	return response.body
}

export async function sendCommandBody(baseUrl, body) {
	await got.post(`${baseUrl}/video.set`, {
		headers: { 'Content-Type': 'text/plain' },
		body,
		retry: { limit: 0 },
		timeout: { request: REQUEST_TIMEOUT },
	})
}

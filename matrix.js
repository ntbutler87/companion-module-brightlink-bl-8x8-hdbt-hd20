// Parsing for the BrightLink BL-8X8-HDBT-HD20 `all_dat.get` response.
//
// The device replies with exactly 160 `;`-separated segments in a fixed order and
// no trailing separator. Offsets and field meanings follow the API spec at
// https://github.com/ntbutler87/BLMatrixServer/blob/main/API_SPEC.md

export const PORT_COUNT = 8
export const SEGMENT_COUNT = 160

// Start of each block within the 160 segments.
const SEG = {
	SWITCH: 0, // 48 segments: 6 per index (see parseSwitchBlock)
	EDID_DEFAULT: 48,
	EDID_USER: 56,
	EDID_INPUT: 64,
	EDID_HDMI_OUT: 72,
	EDID_HDBT_OUT: 80,
	NAME_INPUT: 88,
	NAME_HDMI_OUT: 96,
	NAME_HDBT_OUT: 104,
	SCENE_NAME: 112,
	CREDENTIALS: 120,
	STATUS_INPUT: 136,
	STATUS_HDMI_OUT: 144,
	STATUS_HDBT_OUT: 152,
}

// `mode` in `edid_d in<N> mode=<M> data=<D>` selects which table `data` indexes.
export const EDID_MODES = [
	{ id: 0, label: 'Default preset' },
	{ id: 1, label: 'User slot' },
	{ id: 2, label: 'Copy from HDMI output' },
	{ id: 3, label: 'Copy from HDBT output' },
]

// `enc` in `audio_d in<N> enc=<E>`.
export const AUDIO_SOURCES = [
	{ id: 0, label: 'Mute' },
	{ id: 1, label: 'HDMI embedded' },
	{ id: 2, label: 'Analog' },
]

// An `oed_*` readback of this value means no display is attached.
const UNPLUGGED = 'unplug'

const buildPorts = (count, prefix, extra) =>
	Array.from({ length: count }, (_, i) => ({
		id: i + 1,
		label: `${prefix}${i + 1}`,
		sig: 0,
		rat: null,
		col: null,
		hdcp: null,
		bit: null,
		type: prefix,
		...extra,
	}))

const buildEdidTable = (count, prefix) =>
	Array.from({ length: count }, (_, i) => ({
		id: i + 1,
		label: `${prefix} ${i + 1}`,
		value: '',
	}))

export const statusSchema = {
	isConnected: false,
	ip: null,
	HDMI_IN: buildPorts(PORT_COUNT, 'HDMI_IN', {
		pw5v: null,
		hasSource: false,
		edidMode: 0,
		edidSlot: 1,
		edid: '',
		audio: 1,
	}),
	HDMI_OUT: buildPorts(PORT_COUNT, 'HDMI_OUT', {
		hpd: null,
		input: 1,
		hasDisplay: false,
		edid: '',
		hdmiAudio: null,
		iis: null,
		spdif: null,
	}),
	HDBT_OUT: buildPorts(PORT_COUNT, 'HDBT_OUT', {
		hpd: null,
		input: 1,
		hasDisplay: false,
		edid: '',
	}),
	Scenes: Array.from({ length: PORT_COUNT }, (_, i) => ({
		id: i + 1,
		label: `Scene${i + 1}`,
		type: 'Scene',
	})),
	EDID_DEFAULT: buildEdidTable(PORT_COUNT, 'Preset'),
	EDID_USER: buildEdidTable(PORT_COUNT, 'User slot'),
}

// The schema is a template. Every caller needs its own copy — a Companion install
// can hold several instances of this module, and they must not share port state.
export const createStatus = () => structuredClone(statusSchema)

// A segment's value is everything after the first ':'. Names and EDID strings may
// contain spaces and may be empty, but never ':' or ';', so this cannot truncate.
const segmentValue = (segments, index) => {
	const segment = segments[index]
	if (typeof segment !== 'string') return ''
	const split = segment.indexOf(':')
	return split === -1 ? '' : segment.slice(split + 1)
}

const toInt = (value) => {
	const parsed = parseInt(value, 10)
	return Number.isNaN(parsed) ? null : parsed
}

// Ports 2-8 of a status block carry no label, so strip the label from port 1 only
// and read the remaining ports positionally.
const parseStatusBlock = (segments, start, label) => {
	const ports = []
	for (let i = 0; i < PORT_COUNT; i++) {
		const raw = (segments[start + i] ?? '').replace(new RegExp(`^${label}:`), '')
		const fields = {}
		for (const pair of raw.split(',')) {
			const [key, value] = pair.split('=')
			if (key) fields[key.trim()] = toInt(value)
		}
		ports.push(fields)
	}
	return ports
}

const applyStatusFields = (port, fields) => {
	port.sig = fields.sig ?? 0
	port.rat = fields.rat ?? null
	port.col = fields.col ?? null
	port.hdcp = fields.hdcp ?? null
	port.bit = fields.bit ?? null
}

const VO = /^VO:(\d+)IN:(\d+)$/
const EDID_ASSIGN = /^E:(\d+)M:(\d+)D:(\d+)$/
const AUDIO_IN = /^AI:(\d+)M:(\d+)$/
const AUDIO_OUT_HDMI = /^AO:(\d+)HDMI:(\d+)$/
const AUDIO_OUT_IIS = /^AO:(\d+)iis:(\d+)$/
const AUDIO_OUT_SPDIF = /^AO:(\d+)spdif:(\d+)$/

// Segments 0-47 interleave six fields per index, and the index means different
// things in different fields: VO:/AO: are output-indexed, E:/AI: are input-indexed.
// Match by key rather than by position so the two never get crossed.
const parseSwitchBlock = (segments, status) => {
	for (let i = SEG.SWITCH; i < SEG.EDID_DEFAULT; i++) {
		const segment = segments[i] ?? ''
		let match

		if ((match = VO.exec(segment))) {
			const output = status.HDMI_OUT[toInt(match[1]) - 1]
			const hdbt = status.HDBT_OUT[toInt(match[1]) - 1]
			const input = toInt(match[2])
			// VO: is the only routing field on the device; HDMI and HDBT output N
			// are one logical output and always follow it together.
			if (output) output.input = input
			if (hdbt) hdbt.input = input
		} else if ((match = EDID_ASSIGN.exec(segment))) {
			const input = status.HDMI_IN[toInt(match[1]) - 1]
			if (input) {
				input.edidMode = toInt(match[2])
				input.edidSlot = toInt(match[3])
			}
		} else if ((match = AUDIO_IN.exec(segment))) {
			const input = status.HDMI_IN[toInt(match[1]) - 1]
			if (input) input.audio = toInt(match[2])
		} else if ((match = AUDIO_OUT_HDMI.exec(segment))) {
			const output = status.HDMI_OUT[toInt(match[1]) - 1]
			if (output) output.hdmiAudio = toInt(match[2])
		} else if ((match = AUDIO_OUT_IIS.exec(segment))) {
			const output = status.HDMI_OUT[toInt(match[1]) - 1]
			if (output) output.iis = toInt(match[2])
		} else if ((match = AUDIO_OUT_SPDIF.exec(segment))) {
			const output = status.HDMI_OUT[toInt(match[1]) - 1]
			if (output) output.spdif = toInt(match[2])
		}
	}
}

/**
 * Parse an `all_dat.get` body into a fresh status object.
 *
 * @param {string} statusString raw response body
 * @returns {object} a new status object (never the shared schema)
 * @throws {Error} if the body is not a well-formed 160-segment response
 */
export const parseStatusString = (statusString) => {
	if (typeof statusString !== 'string' || statusString.length === 0) {
		throw new Error('empty response from device')
	}

	const segments = statusString.split(';')
	if (segments.length !== SEGMENT_COUNT) {
		throw new Error(`expected ${SEGMENT_COUNT} segments, got ${segments.length}`)
	}

	const status = createStatus()
	status.isConnected = true

	parseSwitchBlock(segments, status)

	const inputStatus = parseStatusBlock(segments, SEG.STATUS_INPUT, 'INPORT')
	const hdmiStatus = parseStatusBlock(segments, SEG.STATUS_HDMI_OUT, 'OUTHDMIPORT')
	const hdbtStatus = parseStatusBlock(segments, SEG.STATUS_HDBT_OUT, 'OUTHDBTPORT')

	for (let i = 0; i < PORT_COUNT; i++) {
		const input = status.HDMI_IN[i]
		input.label = segmentValue(segments, SEG.NAME_INPUT + i) || input.label
		input.edid = segmentValue(segments, SEG.EDID_INPUT + i)
		applyStatusFields(input, inputStatus[i])
		input.pw5v = inputStatus[i].pw5v ?? null
		// pw5v reads 1 on every port on this hardware, including empty ones.
		// sig is the only usable source-present test.
		input.hasSource = input.sig === 1

		const hdmi = status.HDMI_OUT[i]
		hdmi.label = segmentValue(segments, SEG.NAME_HDMI_OUT + i) || hdmi.label
		hdmi.edid = segmentValue(segments, SEG.EDID_HDMI_OUT + i)
		applyStatusFields(hdmi, hdmiStatus[i])
		hdmi.hpd = hdmiStatus[i].hpd ?? null
		hdmi.hasDisplay = hasDisplay(hdmi)

		const hdbt = status.HDBT_OUT[i]
		hdbt.label = segmentValue(segments, SEG.NAME_HDBT_OUT + i) || hdbt.label
		hdbt.edid = segmentValue(segments, SEG.EDID_HDBT_OUT + i)
		applyStatusFields(hdbt, hdbtStatus[i])
		hdbt.hpd = hdbtStatus[i].hpd ?? null
		hdbt.hasDisplay = hasDisplay(hdbt)

		status.Scenes[i].label = segmentValue(segments, SEG.SCENE_NAME + i) || status.Scenes[i].label
		status.EDID_DEFAULT[i].value = segmentValue(segments, SEG.EDID_DEFAULT + i)
		status.EDID_USER[i].value = segmentValue(segments, SEG.EDID_USER + i)
	}

	return status
}

// Output sig is 0 on plenty of ports that are driving a display, so it must not be
// used here. hpd and the oed_* EDID readback are independent; OR them.
function hasDisplay(port) {
	if (port.hpd === 1) return true
	const edid = (port.edid ?? '').trim().toLowerCase()
	return edid !== '' && edid !== UNPLUGGED
}

// The stock video page shows one indicator per logical output, lit when either half
// is connected.
export const outputHasDisplay = (status, outputId) =>
	Boolean(status?.HDMI_OUT?.[outputId - 1]?.hasDisplay) || Boolean(status?.HDBT_OUT?.[outputId - 1]?.hasDisplay)

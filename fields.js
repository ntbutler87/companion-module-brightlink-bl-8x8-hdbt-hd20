import { AUDIO_SOURCES, EDID_MODES, PORT_COUNT } from './matrix.js'

// Build dropdown choices from live device state so ports show the names configured
// on the matrix rather than HDMI_IN1/HDMI_OUT1 placeholders.
export const portChoices = (ports) => ports.map((port) => ({ id: port.id, label: `${port.id}: ${port.label}` }))

export const FIELDS = {
	// `id` is overridable because existing actions already store their values under
	// specific option ids that must keep working.
	InputSelect: (self, id = 'input', label = 'Input') => ({
		type: 'dropdown',
		label,
		id,
		default: 1,
		choices: portChoices(self.matrixStatus.HDMI_IN),
	}),

	OutputSelect: (self, id = 'output', label = 'Output') => ({
		type: 'dropdown',
		label,
		id,
		default: 1,
		choices: portChoices(self.matrixStatus.HDMI_OUT),
	}),

	SceneSelect: (self, id = 'sceneNumber', label = 'Scene') => ({
		type: 'dropdown',
		label,
		id,
		default: 1,
		choices: self.matrixStatus.Scenes.map((scene) => ({
			id: scene.id,
			label: `${scene.id}: ${scene.label}`,
		})),
	}),

	// The device treats HDMI output N and HDBT output N as one logical output for
	// routing, but they have separate names, EDIDs and hot-plug state.
	OutputHalf: {
		type: 'dropdown',
		label: 'Output half',
		id: 'half',
		default: 'either',
		choices: [
			{ id: 'either', label: 'Either (HDMI or HDBT)' },
			{ id: 'hdmi', label: 'HDMI only' },
			{ id: 'hdbt', label: 'HDBT only' },
		],
	},

	PortType: {
		type: 'dropdown',
		label: 'Port type',
		id: 'portType',
		default: 'in',
		choices: [
			{ id: 'in', label: 'Input' },
			{ id: 'hdmi', label: 'HDMI output' },
			{ id: 'hdbt', label: 'HDBT output' },
		],
	},

	PortNumber: {
		type: 'number',
		label: 'Port number',
		id: 'portNumber',
		default: 1,
		min: 1,
		max: PORT_COUNT,
	},

	PortName: {
		type: 'textinput',
		label: 'New name (max 12 characters; ; : # are not allowed)',
		id: 'portName',
		default: '',
		useVariables: true,
	},

	Operation: {
		type: 'dropdown',
		label: 'Operation',
		id: 'operation',
		// Confirmed against firmware: 1 saves, 2 recalls. The stock UI never sends 0.
		default: 2,
		choices: [
			{ id: 0, label: 'Clear' },
			{ id: 1, label: 'Save' },
			{ id: 2, label: 'Recall' },
		],
	},

	AudioSource: {
		type: 'dropdown',
		label: 'Audio source',
		id: 'audioSource',
		default: 1,
		choices: AUDIO_SOURCES,
	},

	AudioIis: {
		type: 'dropdown',
		label: 'Analog / I²S output',
		id: 'iis',
		default: 1,
		choices: [
			{ id: 0, label: 'Disabled' },
			{ id: 1, label: 'Enabled' },
		],
	},

	AudioSpdif: {
		type: 'dropdown',
		label: 'S/PDIF output',
		id: 'spdif',
		default: 1,
		choices: [
			{ id: 0, label: 'Disabled' },
			{ id: 1, label: 'Enabled' },
		],
	},

	EdidMode: {
		type: 'dropdown',
		label: 'EDID source',
		id: 'edidMode',
		default: 0,
		choices: EDID_MODES,
	},

	EdidSlot: {
		type: 'number',
		label: 'Slot / output number (1-8)',
		id: 'edidSlot',
		default: 1,
		min: 1,
		max: PORT_COUNT,
	},

	// `edid_d user<N>` can only copy from an output, so modes 0 and 1 are invalid here.
	EdidCopyMode: {
		type: 'dropdown',
		label: 'Copy EDID from',
		id: 'edidMode',
		default: 2,
		choices: EDID_MODES.filter((mode) => mode.id === 2 || mode.id === 3),
	},
}

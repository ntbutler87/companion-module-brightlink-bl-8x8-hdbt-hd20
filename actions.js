import { FIELDS } from './fields.js'
import { PORT_COUNT } from './matrix.js'

// As of module-api 2.x Companion resolves variables and expressions before the
// callback runs, so option values arrive as plain numbers or strings.
function resolveNumber(value) {
	const parsed = parseInt(value, 10)
	return Number.isNaN(parsed) ? null : parsed
}

const inRange = (value, min, max) => value !== null && value >= min && value <= max

// The firmware splits commands on '#' and fields on ' ', and strips nothing else.
// A name containing ';', ':' or '#' would corrupt the response format the device
// later serves back, so those characters cannot be sent.
const sanitisePortName = (name) =>
	name
		.replace(/[;:#]/g, '')
		.replace(/[^ -~]/g, '')
		.slice(0, 12)

export function getActionDefinitions(self) {
	const actions = {
		selectInput: {
			name: 'Select input (for use with "Route selected input")',
			options: [FIELDS.InputSelect(self)],
			callback: async (action) => {
				const input = resolveNumber(action.options.input)
				if (!inRange(input, 1, PORT_COUNT)) {
					self.log('warn', `Select input: ${action.options.input} is not a valid input`)
					return
				}
				// Pressing the selected input again clears the selection.
				self.setSelectedInput(self.selectedInput === input ? null : input)
			},
		},

		switchOutput: {
			name: 'Route selected input to output',
			options: [FIELDS.OutputSelect(self)],
			callback: async (action) => {
				const output = resolveNumber(action.options.output)
				if (!inRange(output, 1, PORT_COUNT)) {
					self.log('warn', `Route to output: ${action.options.output} is not a valid output`)
					return
				}
				if (self.selectedInput === null) {
					self.log('warn', 'Route to output: no input is selected — use the "Select input" action first')
					return
				}
				await self.sendCommands(`video_d out${output} matrix=${self.selectedInput}`)
			},
		},

		mapIOpath: {
			name: 'Map IO path',
			options: [
				FIELDS.InputSelect(self, 'inputPort', 'Input port'),
				FIELDS.OutputSelect(self, 'outputPort', 'Output port'),
			],
			callback: async (action) => {
				const input = resolveNumber(action.options.inputPort)
				const output = resolveNumber(action.options.outputPort)
				if (!inRange(input, 1, PORT_COUNT) || !inRange(output, 1, PORT_COUNT)) {
					self.log('warn', `Map IO path: input ${input} / output ${output} is out of range`)
					return
				}
				await self.sendCommands(`video_d out${output} matrix=${input}`)
			},
		},

		getStatus: {
			name: 'Get status',
			options: [],
			callback: async () => {
				await self.pollMatrixStatus()
			},
		},

		scene: {
			name: 'Scene',
			options: [FIELDS.SceneSelect(self), FIELDS.Operation],
			callback: async (action) => {
				const scene = resolveNumber(action.options.sceneNumber)
				const operation = resolveNumber(action.options.operation)
				if (!inRange(scene, 1, PORT_COUNT) || !inRange(operation, 0, 2)) {
					self.log('warn', `Scene: scene ${scene} / operation ${operation} is out of range`)
					return
				}
				await self.sendCommands(`group${scene} exe=${operation}`)
			},
		},

		audioInput: {
			name: 'Set input audio source',
			options: [FIELDS.InputSelect(self), FIELDS.AudioSource],
			callback: async (action) => {
				const input = resolveNumber(action.options.input)
				const source = resolveNumber(action.options.audioSource)
				if (!inRange(input, 1, PORT_COUNT) || !inRange(source, 0, 2)) {
					self.log('warn', `Input audio: input ${input} / source ${source} is out of range`)
					return
				}
				await self.sendCommands(`audio_d in${input} enc=${source}`)
			},
		},

		audioOutput: {
			name: 'Set output audio enables',
			options: [FIELDS.OutputSelect(self), FIELDS.AudioIis, FIELDS.AudioSpdif],
			callback: async (action) => {
				const output = resolveNumber(action.options.output)
				const iis = resolveNumber(action.options.iis)
				const spdif = resolveNumber(action.options.spdif)
				if (!inRange(output, 1, PORT_COUNT) || !inRange(iis, 0, 1) || !inRange(spdif, 0, 1)) {
					self.log('warn', `Output audio: output ${output} / iis ${iis} / spdif ${spdif} is out of range`)
					return
				}
				// The firmware expects both flags, iis first.
				await self.sendCommands(`audio_d out${output} iis=${iis} spdif=${spdif}`)
			},
		},

		edidInput: {
			name: 'Assign EDID to input',
			options: [FIELDS.InputSelect(self), FIELDS.EdidMode, FIELDS.EdidSlot],
			callback: async (action) => {
				const input = resolveNumber(action.options.input)
				const mode = resolveNumber(action.options.edidMode)
				const slot = resolveNumber(action.options.edidSlot)
				if (!inRange(input, 1, PORT_COUNT) || !inRange(mode, 0, 3) || !inRange(slot, 1, PORT_COUNT)) {
					self.log('warn', `Input EDID: input ${input} / mode ${mode} / slot ${slot} is out of range`)
					return
				}
				await self.sendCommands(`edid_d in${input} mode=${mode} data=${slot}`)
			},
		},

		edidUser: {
			name: 'Copy display EDID into a user slot',
			options: [
				{
					type: 'number',
					label: 'User slot (1-8)',
					id: 'userSlot',
					default: 1,
					min: 1,
					max: PORT_COUNT,
				},
				FIELDS.EdidCopyMode,
				FIELDS.EdidSlot,
			],
			callback: async (action) => {
				const userSlot = resolveNumber(action.options.userSlot)
				const mode = resolveNumber(action.options.edidMode)
				const slot = resolveNumber(action.options.edidSlot)
				if (!inRange(userSlot, 1, PORT_COUNT) || !inRange(mode, 2, 3) || !inRange(slot, 1, PORT_COUNT)) {
					self.log('warn', `User EDID: slot ${userSlot} / mode ${mode} / output ${slot} is out of range`)
					return
				}
				await self.sendCommands(`edid_d user${userSlot} mode=${mode} data=${slot}`)
			},
		},

		renamePort: {
			name: 'Rename port',
			options: [FIELDS.PortType, FIELDS.PortNumber, FIELDS.PortName],
			callback: async (action) => {
				const portNumber = resolveNumber(action.options.portNumber)
				const portType = action.options.portType
				if (!inRange(portNumber, 1, PORT_COUNT) || !['in', 'hdmi', 'hdbt'].includes(portType)) {
					self.log('warn', `Rename port: ${portType}${portNumber} is not a valid port`)
					return
				}
				const requested = String(action.options.portName ?? '')
				const name = sanitisePortName(requested)
				if (name !== requested) {
					self.log('warn', `Rename port: name trimmed to "${name}" (max 12 characters, no ; : #)`)
				}
				await self.sendCommands(`port ${portType}${portNumber} name=${name}`)
			},
		},
	}

	const mapIOportMultiOptions = []
	for (let i = 1; i <= PORT_COUNT; i++) {
		mapIOportMultiOptions.push(FIELDS.InputSelect(self, String(i), `Map output ${i} to input:`))
		mapIOportMultiOptions[i - 1].default = i
	}

	actions.mapIOpathMulti = {
		name: 'Map IO path - multi',
		options: mapIOportMultiOptions,
		callback: async (action) => {
			const commands = []
			for (let i = 1; i <= PORT_COUNT; i++) {
				const input = resolveNumber(action.options[i])
				if (!inRange(input, 1, PORT_COUNT)) {
					self.log('warn', `Map IO path - multi: output ${i} has invalid input ${action.options[i]}, skipped`)
					continue
				}
				commands.push(`video_d out${i} matrix=${input}`)
			}
			await self.sendCommands(commands)
		},
	}

	return actions
}

import { combineRgb } from '@companion-module/base'
import { FIELDS } from './fields.js'
import { outputHasDisplay } from './matrix.js'

const toId = (value) => {
	const parsed = parseInt(value, 10)
	return Number.isNaN(parsed) ? null : parsed
}

const routedInput = (self, outputId) => self.matrixStatus?.HDMI_OUT?.[outputId - 1]?.input ?? null

export function getFeedbackDefinitions(self) {
	return {
		selected: {
			type: 'boolean',
			name: 'Specified input is the selected input',
			description: 'Highlights the input currently held by the "Select input" action',
			options: [FIELDS.InputSelect(self)],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 0, 0),
			},
			callback: (feedback) => self.selectedInput !== null && self.selectedInput === toId(feedback.options.input),
		},

		output: {
			type: 'boolean',
			name: 'Selected input is routed to output',
			description: 'Highlights outputs already fed by the selected input',
			options: [FIELDS.OutputSelect(self)],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(0, 255, 0),
			},
			callback: (feedback) => {
				const output = toId(feedback.options.output)
				if (output === null || self.selectedInput === null) return false
				return routedInput(self, output) === self.selectedInput
			},
		},

		input_output: {
			type: 'boolean',
			name: 'Specified input is routed to specified output',
			description: 'Highlights a fixed input-to-output route regardless of the current selection',
			options: [FIELDS.InputSelect(self), FIELDS.OutputSelect(self)],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(0, 255, 0),
			},
			callback: (feedback) => {
				const input = toId(feedback.options.input)
				const output = toId(feedback.options.output)
				if (input === null || output === null) return false
				return routedInput(self, output) === input
			},
		},

		input_signal: {
			type: 'boolean',
			name: 'Input has a source connected',
			// pw5v reads 1 on every port on this hardware, so sig is the only usable test.
			description: 'True when the input reports sig=1 — a source is connected and sending video',
			options: [FIELDS.InputSelect(self)],
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 128, 0),
			},
			callback: (feedback) => {
				const input = toId(feedback.options.input)
				return input !== null && Boolean(self.matrixStatus?.HDMI_IN?.[input - 1]?.hasSource)
			},
		},

		output_display: {
			type: 'boolean',
			name: 'Output has a display connected',
			// Output sig reads 0 on plenty of ports that are driving a display, so the
			// test is hpd, ORed with the EDID readback.
			description: 'True when the output reports hpd=1 or reads back an EDID other than "Unplug"',
			options: [FIELDS.OutputSelect(self), FIELDS.OutputHalf],
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 128, 0),
			},
			callback: (feedback) => {
				const output = toId(feedback.options.output)
				if (output === null) return false
				switch (feedback.options.half) {
					case 'hdmi':
						return Boolean(self.matrixStatus?.HDMI_OUT?.[output - 1]?.hasDisplay)
					case 'hdbt':
						return Boolean(self.matrixStatus?.HDBT_OUT?.[output - 1]?.hasDisplay)
					default:
						return outputHasDisplay(self.matrixStatus, output)
				}
			},
		},
	}
}

import { combineRgb } from '@companion-module/base'
import { PORT_COUNT } from './matrix.js'

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const GREEN = combineRgb(0, 255, 0)
const DARK_GREEN = combineRgb(0, 100, 0)
const RED = combineRgb(255, 0, 0)

const button = (name, text, steps, feedbacks = []) => ({
	type: 'simple',
	name,
	style: { text, size: 'auto', color: WHITE, bgcolor: BLACK },
	steps: [{ down: steps, up: [] }],
	feedbacks,
})

// Presets are rebuilt whenever the device reports new port or scene names, so the
// labels baked in here stay in step with the matrix.
export function getPresetDefinitions(self) {
	const presets = {}
	const sections = []
	const status = self.matrixStatus

	// module-api 2.x dropped the per-preset `category` field: presets are defined
	// once and then referenced by id from the section they should appear under.
	const section = (id, name) => {
		const definitions = []
		sections.push({ id, name, definitions })
		return (presetId, definition) => {
			presets[presetId] = definition
			definitions.push(presetId)
		}
	}

	const addSceneRecall = section('scene_recall', 'Scene recall')
	const addSceneSave = section('scene_save', 'Scene save')
	const addSelectInput = section('routing_select_input', 'Routing - select input')
	const addTakeOutput = section('routing_take_output', 'Routing - take to output')
	const addStatusInput = section('status_inputs', 'Status - inputs')
	const addStatusOutput = section('status_outputs', 'Status - outputs')
	const addMacro = section('macro', 'Macro')

	for (const scene of status.Scenes) {
		addSceneRecall(
			`scene_${scene.id}_recall`,
			button(`Scene ${scene.id} recall`, `${scene.label}\nRecall`, [
				{
					actionId: 'scene',
					options: { sceneNumber: scene.id, operation: 2 },
				},
			]),
		)
		addSceneSave(
			`scene_${scene.id}_save`,
			button(`Scene ${scene.id} save`, `${scene.label}\nSave`, [
				{
					actionId: 'scene',
					options: { sceneNumber: scene.id, operation: 1 },
				},
			]),
		)
	}

	// Two-step routing panel: press an input, then press the outputs to send it to.
	for (const input of status.HDMI_IN) {
		addSelectInput(
			`select_input_${input.id}`,
			button(
				`Select input ${input.id}`,
				input.label,
				[{ actionId: 'selectInput', options: { input: input.id } }],
				[
					{
						feedbackId: 'selected',
						options: { input: input.id },
						style: { color: BLACK, bgcolor: RED },
					},
					{
						feedbackId: 'input_signal',
						options: { input: input.id },
						style: { color: GREEN },
					},
				],
			),
		)
	}

	for (const output of status.HDMI_OUT) {
		addTakeOutput(
			`take_output_${output.id}`,
			button(
				`Take selected input to output ${output.id}`,
				output.label,
				[{ actionId: 'switchOutput', options: { output: output.id } }],
				[
					{
						feedbackId: 'output',
						options: { output: output.id },
						style: { color: BLACK, bgcolor: GREEN },
					},
					{
						feedbackId: 'output_display',
						options: { output: output.id, half: 'either' },
						style: { bgcolor: DARK_GREEN },
					},
				],
			),
		)
	}

	for (const input of status.HDMI_IN) {
		addStatusInput(
			`status_input_${input.id}`,
			button(
				`Input ${input.id} source present`,
				`${input.label}\nSRC`,
				[],
				[
					{
						feedbackId: 'input_signal',
						options: { input: input.id },
						style: { color: WHITE, bgcolor: DARK_GREEN },
					},
				],
			),
		)
	}

	for (const output of status.HDMI_OUT) {
		addStatusOutput(
			`status_output_${output.id}`,
			button(
				`Output ${output.id} display present`,
				`${output.label}\nDISP`,
				[],
				[
					{
						feedbackId: 'output_display',
						options: { output: output.id, half: 'either' },
						style: { color: WHITE, bgcolor: DARK_GREEN },
					},
				],
			),
		)
	}

	const oneToOne = {}
	for (let i = 1; i <= PORT_COUNT; i++) {
		oneToOne[i] = i
	}
	addMacro(
		'macro_1_1',
		button('Maps in1 to out1, in2 to out2, etc.', '1-1 IO map', [{ actionId: 'mapIOpathMulti', options: oneToOne }]),
	)

	addMacro(
		'get_status',
		button('Refresh status from the matrix', 'Refresh\nstatus', [{ actionId: 'getStatus', options: {} }]),
	)

	// Scenes and ports come from the device, so a section can legitimately be empty
	// before the first successful poll.
	const structure = sections.filter((s) => s.definitions.length > 0)

	return { structure, presets }
}

import { outputHasDisplay } from './matrix.js'

// module-api 2.x expects definitions keyed by variable id rather than an array
// of { variableId, name } entries.
export function getVariableDefinitions(self) {
	const definitions = {
		selected_input: { name: 'Selected input number' },
		selected_input_name: { name: 'Selected input name' },
	}

	for (const input of self.matrixStatus.HDMI_IN) {
		definitions[`input_${input.id}_name`] = { name: `Input ${input.id} name` }
		definitions[`input_${input.id}_signal`] = {
			name: `Input ${input.id} has a source (0/1)`,
		}
		// Retained from earlier module versions so existing buttons keep working.
		definitions[`input_route${input.id}`] = {
			name: `Input ${input.id} outputs`,
		}
	}

	for (const output of self.matrixStatus.HDMI_OUT) {
		definitions[`output_${output.id}_name`] = {
			name: `HDMI output ${output.id} name`,
		}
		definitions[`output_${output.id}_input`] = {
			name: `Output ${output.id} source input number`,
		}
		definitions[`output_${output.id}_input_name`] = {
			name: `Output ${output.id} source input name`,
		}
		definitions[`output_${output.id}_display`] = {
			name: `Output ${output.id} has a display (0/1)`,
		}
		definitions[`output_route${output.id}`] = {
			name: `Output ${output.id} source input number`,
		}
	}

	for (const output of self.matrixStatus.HDBT_OUT) {
		definitions[`hdbt_${output.id}_name`] = {
			name: `HDBT output ${output.id} name`,
		}
		definitions[`hdbt_${output.id}_display`] = {
			name: `HDBT output ${output.id} has a display (0/1)`,
		}
	}

	for (const scene of self.matrixStatus.Scenes) {
		definitions[`scene_${scene.id}_name`] = { name: `Scene ${scene.id} name` }
	}

	return definitions
}

export function getVariableValues(self) {
	const status = self.matrixStatus
	const values = {}

	const selected = status.HDMI_IN.find((input) => input.id === self.selectedInput)
	values.selected_input = self.selectedInput ?? ''
	values.selected_input_name = selected?.label ?? ''

	for (const input of status.HDMI_IN) {
		values[`input_${input.id}_name`] = input.label
		values[`input_${input.id}_signal`] = input.hasSource ? 1 : 0
		values[`input_route${input.id}`] = status.HDMI_OUT.filter((output) => output.input === input.id)
			.map((output) => output.id)
			.join(',')
	}

	for (const output of status.HDMI_OUT) {
		const source = status.HDMI_IN.find((input) => input.id === output.input)
		values[`output_${output.id}_name`] = output.label
		values[`output_${output.id}_input`] = output.input
		values[`output_${output.id}_input_name`] = source?.label ?? ''
		values[`output_${output.id}_display`] = outputHasDisplay(status, output.id) ? 1 : 0
		values[`output_route${output.id}`] = output.input
	}

	for (const output of status.HDBT_OUT) {
		values[`hdbt_${output.id}_name`] = output.label
		values[`hdbt_${output.id}_display`] = output.hasDisplay ? 1 : 0
	}

	for (const scene of status.Scenes) {
		values[`scene_${scene.id}_name`] = scene.label
	}

	return values
}

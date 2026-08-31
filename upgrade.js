import { EmptyUpgradeScript } from '@companion-module/base'

export const upgradeScripts = [
	// Slots 0 and 1 upgraded generic-http options (contenttype, rejectUnauthorized)
	// that this module never had. They are kept as no-ops rather than deleted so
	// existing installs keep their recorded upgrade index.
	EmptyUpgradeScript,
	EmptyUpgradeScript,

	// The "switchOutput" action stored its output port under an option id of "input",
	// left over from the action being a copy of "selectInput".
	function v2_6_0(context, props) {
		const result = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'switchOutput' && action.options.output === undefined) {
				// module-api 2.x wraps stored option values as { value, isExpression }.
				action.options.output = action.options.input ?? {
					value: 1,
					isExpression: false,
				}
				delete action.options.input
				result.updatedActions.push(action)
			}
		}

		return result
	},
]

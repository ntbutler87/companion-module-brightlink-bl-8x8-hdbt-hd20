import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({})

const customConfig = [
	...baseConfig,

	{
		languageOptions: {
			sourceType: 'module',
		},
		rules: {
			//   indent: ["error", "tab"],
			//   "no-tabs": "off",
		},
	},
]

export default customConfig

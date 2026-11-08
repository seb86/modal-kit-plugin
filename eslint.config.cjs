/**
 * Extends the `@wordpress/scripts` ESLint config.
 */
const defaultConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );

module.exports = [
	{
		ignores: [
			'build/**',
			'**/node_modules/**',
			'vendor/**',
			'artifacts/**',
			'dist/**',
		],
	},
	...defaultConfig,
	{
		// Test tooling and local scripts use the dev dependencies.
		files: [ 'tests/**', 'webpack.config.js', '*.{js,mjs,cjs}', 'bin/**' ],
		rules: {
			'import/no-extraneous-dependencies': 'off',
		},
	},
];

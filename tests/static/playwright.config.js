/**
 * Playwright config for the static-export suite: plain browsing of the
 * exported site, no WordPress login, no wp-env.
 */
const { defineConfig, devices } = require( '@playwright/test' );

module.exports = defineConfig( {
	// The plugin's specs.
	testDir: '.',
	testMatch: '*.spec.js',
	outputDir: '../../artifacts/static-results',
	reporter: process.env.CI ? 'github' : 'list',
	timeout: 30000,
	use: {
		baseURL: process.env.STATIC_BASE_URL,
		trace: 'retain-on-failure',
	},
	projects: [ { name: 'chromium', use: { ...devices[ 'Desktop Chrome' ] } } ],
} );

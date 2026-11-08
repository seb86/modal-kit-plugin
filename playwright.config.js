/**
 * Extends the `@wordpress/scripts` Playwright config.
 *
 * Locally, .env points WP_BASE_URL at the Laragon test site. In CI the
 * workflow starts a wp-env test site and sets WP_BASE_URL itself.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const envFile = path.join( __dirname, '.env' );

if ( fs.existsSync( envFile ) ) {
	process.loadEnvFile( envFile );
}

const { defineConfig, devices } = require( '@playwright/test' );
const baseConfig = require( '@wordpress/scripts/config/playwright.config' );

module.exports = defineConfig( {
	...baseConfig,
	testDir: './tests/e2e',
	testMatch: '**/*.spec.js',
	projects: [ { name: 'chromium', use: { ...devices[ 'Desktop Chrome' ] } } ],
	webServer: undefined,
	// The baselines are taken on Windows, and fonts render differently on
	// GitHub's Linux runners, so screenshots are compared locally only.
	ignoreSnapshots: !! process.env.CI,
} );

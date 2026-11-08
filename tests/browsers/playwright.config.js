/**
 * Cross-browser suite: the front-end specs, plus tests/browsers, on the engines
 * `test:e2e` doesn't use. Editor specs stay on Chromium: the block editor is
 * WordPress's own, and these are about what visitors get.
 *
 *   npx playwright install firefox webkit      once
 *   npm run test:browsers
 */
const { defineConfig, devices } = require( '@playwright/test' );
const baseConfig = require( '../../playwright.config' );

module.exports = defineConfig( {
	...baseConfig,
	testDir: '..',
	testMatch: [
		'e2e/runtime.spec.js',
		'e2e/rules.spec.js',
		'e2e/security.spec.js',
		'e2e/video.spec.js',
		'e2e/rtl.spec.js',
		'browsers/*.spec.js',
	],
	outputDir: '../../artifacts/browser-results',
	// The screenshot baselines are Chromium's.
	ignoreSnapshots: true,
	projects: [
		{ name: 'firefox', use: { ...devices[ 'Desktop Firefox' ] } },
		{ name: 'webkit', use: { ...devices[ 'Desktop Safari' ] } },
		{ name: 'iphone', use: { ...devices[ 'iPhone 14' ] } },
		{ name: 'android', use: { ...devices[ 'Pixel 7' ] } },
	],
} );

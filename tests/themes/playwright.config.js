/**
 * Playwright config for the theme comparison (`npm run test:themes`).
 *
 * The reference screenshots are made fresh on this machine, in the reference
 * theme, so they go in artifacts/ and never in Git: font rendering differs
 * between systems, and the comparison is only about the theme.
 */
const path = require( 'path' );
const base = require( '../../playwright.config' );

const artifacts = path
	.join( __dirname, '../../artifacts/themes' )
	.replaceAll( '\\', '/' );

module.exports = {
	...base,
	testDir: __dirname,
	testMatch: '*.spec.js',
	outputDir: `${ artifacts }/results`,
	snapshotPathTemplate: `${ artifacts }/reference/{arg}{ext}`,
	ignoreSnapshots: false,
	// Now and then the browser draws a band of the panel a pixel off, on an
	// unchanged page. A theme's styles would fail every time.
	retries: 1,
	globalSetup: require.resolve( './global-setup.js' ),
	globalTeardown: require.resolve( './global-teardown.js' ),
	reporter: [
		[ 'list' ],
		[ 'json', { outputFile: `${ artifacts }/results.json` } ],
	],
};

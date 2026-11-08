/**
 * Compares Modal Kit's fixed styles across themes (tests/themes).
 *
 *   npm run test:themes                       Every theme in tests/themes/themes.json.
 *   npm run test:themes -- my-theme           Only these themes (slugs, space separated).
 *   npm run test:themes -- --reuse-reference  Keep the last reference screenshots.
 *   npm run test:themes -- --reference=slug   Compare against another theme.
 *
 * Any other --flag goes to Playwright (--headed, --grep=fieldnote).
 *
 * Makes the reference in one theme, compares the others with it, then writes
 * artifacts/themes/index.html. Only WP_BASE_URL is needed; with WP-CLI set up
 * in .env, themes that aren't installed yet are installed from WordPress.org.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadEnv, run } from './lib.mjs';
import { writeReport } from './theme-report.mjs';

/* eslint-disable no-console */

loadEnv();

const ARTIFACTS = join( ROOT, 'artifacts/themes' );
const CONFIG = 'tests/themes/playwright.config.js';
const PLAYWRIGHT = join( ROOT, 'node_modules/@playwright/test/cli.js' );
const LIST = JSON.parse(
	readFileSync( join( ROOT, 'tests/themes/themes.json' ), 'utf8' )
);

const args = process.argv.slice( 2 );
const option = ( name ) =>
	args.find( ( arg ) => arg.startsWith( `--${ name }=` ) )?.split( '=' )[ 1 ];
const named = args.filter( ( arg ) => ! arg.startsWith( '--' ) );
const reuse = args.includes( '--reuse-reference' );
const passThrough = args.filter(
	( arg ) =>
		arg.startsWith( '--' ) &&
		arg !== '--reuse-reference' &&
		! arg.startsWith( '--reference=' )
);

const reference = option( 'reference' ) ?? LIST.reference;
const themes = (
	named.length ? named : [ ...LIST.block, ...LIST.classic ]
).filter( ( theme ) => theme !== reference );

const {
	WP_BASE_URL,
	WP_TESTS_PATH,
	PHP_BINARY = 'php',
	LARAGON_PATH = 'C:/laragon',
} = process.env;
const WP_CLI =
	process.env.WP_CLI_PATH ?? join( LARAGON_PATH, 'bin/wp-cli/wp-cli.phar' );

/**
 * Installs any theme the site is missing, when WP-CLI is set up. Without it,
 * the run stops at the first missing theme with a message saying so.
 *
 * @param {string[]} slugs Theme slugs.
 */
function installMissing( slugs ) {
	if ( ! WP_TESTS_PATH || ! existsSync( WP_CLI ) ) {
		return;
	}

	const wp = ( ...command ) =>
		run( PHP_BINARY, [ WP_CLI, `--path=${ WP_TESTS_PATH }`, ...command ], {
			stdio: 'ignore',
		} );

	for ( const slug of slugs ) {
		if ( wp( 'theme', 'is-installed', slug ) !== 0 ) {
			console.log( `Installing ${ slug }…` );

			if ( wp( 'theme', 'install', slug ) !== 0 ) {
				console.warn(
					`  Couldn't install ${ slug } from WordPress.org. Copy it into wp-content/themes.`
				);
			}
		}
	}
}

/**
 * Runs the comparison spec.
 *
 * @param {string[]} slugs  Theme slugs.
 * @param {string}   update Playwright's --update-snapshots value.
 * @return {number} Exit code.
 */
const playwright = ( slugs, update ) =>
	run(
		process.execPath,
		[
			PLAYWRIGHT,
			'test',
			`--config=${ CONFIG }`,
			`--update-snapshots=${ update }`,
			...passThrough,
		],
		{ env: { ...process.env, MODAL_KIT_THEMES: slugs.join( ',' ) } }
	);

if ( ! WP_BASE_URL ) {
	console.error(
		'Set WP_BASE_URL to your test site, in .env or the environment. See THEME-TESTING.md.'
	);
	process.exit( 1 );
}

if ( ! themes.length ) {
	console.error( `Nothing to compare ${ reference } with.` );
	process.exit( 1 );
}

installMissing( [ reference, ...themes ] );
rmSync( join( ARTIFACTS, 'shots' ), { recursive: true, force: true } );

if ( reuse && existsSync( join( ARTIFACTS, 'reference' ) ) ) {
	console.log( 'Reusing the last reference screenshots.' );
} else {
	console.log( `\nMaking the reference in ${ reference }…\n` );
	rmSync( join( ARTIFACTS, 'reference' ), { recursive: true, force: true } );

	if ( playwright( [ reference ], 'all' ) !== 0 ) {
		console.error(
			`\nThe reference theme failed, so nothing was compared. Fix that first.`
		);
		process.exit( 1 );
	}
}

console.log( `\nComparing: ${ themes.join( ', ' ) }\n` );

const code = playwright( themes, 'none' );
const report = writeReport( { reference, themes, artifacts: ARTIFACTS } );

console.log( `\n${ report.summary }\nReport: ${ report.file }` );
process.exitCode = code;

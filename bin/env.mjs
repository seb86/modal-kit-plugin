/**
 * Local environment on Laragon (replaces wp-env).
 *
 *   node bin/env.mjs start                 Link Modal Kit into both sites, activate Modal Kit, check the sites.
 *   node bin/env.mjs status|check          Check that both sites respond.
 *   node bin/env.mjs wp [--tests] <args>   Run WP-CLI against the dev (or test) site.
 *
 * Paths and URLs come from .env (see .env.example).
 */
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readlinkSync,
	rmSync,
	symlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { PLUGINS, loadEnv, pluginDir, run } from './lib.mjs';

/* eslint-disable no-console */

if ( ! loadEnv() ) {
	console.error(
		'No .env file. Copy .env.example to .env and adjust the Laragon paths.'
	);
	process.exit( 1 );
}

const {
	LARAGON_PATH = 'C:/laragon',
	PHP_BINARY = 'php',
	WP_DEV_PATH,
	WP_DEV_URL,
	WP_TESTS_PATH,
	WP_BASE_URL,
} = process.env;

const WP_CLI = join( LARAGON_PATH, 'bin/wp-cli/wp-cli.phar' );

const SITES = [
	{ name: 'dev', path: WP_DEV_PATH, url: WP_DEV_URL },
	{ name: 'tests', path: WP_TESTS_PATH, url: WP_BASE_URL },
];

function wp( site, args ) {
	return run( PHP_BINARY, [ WP_CLI, `--path=${ site.path }`, ...args ] );
}

function isLink( path ) {
	try {
		return lstatSync( path ).isSymbolicLink();
	} catch {
		return false;
	}
}

function link( site ) {
	for ( const plugin of PLUGINS ) {
		const target = resolve( pluginDir( plugin ) );
		const linkPath = join( site.path, 'wp-content/plugins', plugin );

		if ( isLink( linkPath ) ) {
			if ( resolve( readlinkSync( linkPath ) ) === target ) {
				continue;
			}

			// A link to where the repo used to be.
			rmSync( linkPath, { force: true } );
		} else if ( existsSync( linkPath ) ) {
			console.warn(
				`  ${ linkPath } exists and is not a link to ${ target }. Leaving it.`
			);
			continue;
		}

		// Junctions need no admin rights on Windows.
		symlinkSync( target, linkPath, 'junction' );
		console.log( `  linked ${ plugin } into ${ site.name }` );
	}
}

async function check() {
	let ok = true;

	for ( const site of SITES ) {
		try {
			const response = await fetch( site.url, { redirect: 'manual' } );
			ok = ok && response.status < 400;
			console.log(
				`  ${ site.name }: ${ site.url } → HTTP ${ response.status }`
			);
		} catch ( error ) {
			ok = false;
			console.error(
				`  ${ site.name }: ${ site.url } is not responding (${
					error.cause?.code || error.message
				}). Is Laragon running?`
			);
		}
	}

	return ok;
}

const [ command = 'status', ...rest ] = process.argv.slice( 2 );

// Set exitCode rather than calling process.exit(): exiting while fetch
// handles close trips a libuv assertion on Windows.
if ( 'start' === command ) {
	for ( const site of SITES ) {
		link( site );
		wp( site, [ 'plugin', 'activate', 'modal-kit', '--quiet' ] );
	}

	// Test-site helpers (local oEmbed answers).
	const muPlugins = join( WP_TESTS_PATH, 'wp-content/mu-plugins' );
	mkdirSync( muPlugins, { recursive: true } );
	copyFileSync(
		join(
			pluginDir( 'modal-kit' ),
			'tests/e2e/mu-plugins/modal-kit-e2e.php'
		),
		join( muPlugins, 'modal-kit-e2e.php' )
	);
	process.exitCode = ( await check() ) ? 0 : 1;
} else if ( 'status' === command || 'check' === command ) {
	process.exitCode = ( await check() ) ? 0 : 1;
} else if ( 'wp' === command ) {
	const tests = rest[ 0 ] === '--tests';
	const site = tests ? SITES[ 1 ] : SITES[ 0 ];
	process.exitCode = wp( site, tests ? rest.slice( 1 ) : rest );
} else {
	console.error( `Unknown command: ${ command }` );
	process.exitCode = 1;
}

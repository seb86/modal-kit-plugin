/**
 * Static-export suite (plan §5): seeds fixtures, exports the test site with
 * Simply Static, serves the output folder and runs tests/static against it.
 *
 *   Locally (default): the Laragon test site from .env.
 *   CI: STATIC_ENV=wp-env runs WP-CLI inside wp-env; artifacts/static-export
 *   is mapped into the container (.wp-env.json).
 */
import { mkdirSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, loadEnv, pluginDir } from './lib.mjs';
import { serve } from './static-server.mjs';
import { stagePluginCopies, waitForPluginUrls } from './stage-plugins.mjs';

/* eslint-disable no-console */

loadEnv();

const MODE = process.env.STATIC_ENV ?? 'laragon';
const PORT = Number( process.env.STATIC_PORT ?? 8090 );
const EXPORT_DIR = join( ROOT, 'artifacts', 'static-export' );
const pluginInSite = ( slug ) =>
	MODE === 'wp-env'
		? `/var/www/html/wp-content/plugins/${ slug }`
		: pluginDir( slug ).replaceAll( '\\', '/' );

const EXPORT_IN_SITE =
	MODE === 'wp-env'
		? '/var/www/html/wp-content/static-export'
		: EXPORT_DIR.replaceAll( '\\', '/' );

/**
 * Runs WP-CLI on the test site and returns its output.
 *
 * @param {string[]} args Arguments.
 * @return {string} Standard output.
 */
function wp( args ) {
	const [ command, base ] =
		MODE === 'wp-env'
			? [ 'npx', [ '@wordpress/env@12', 'run', 'cli', 'wp' ] ]
			: [
					process.env.PHP_BINARY ?? 'php',
					[
						join(
							process.env.LARAGON_PATH ?? 'C:/laragon',
							'bin/wp-cli/wp-cli.phar'
						),
						`--path=${ process.env.WP_TESTS_PATH }`,
					],
				];

	const result = spawnSync( command, [ ...base, ...args ], {
		cwd: ROOT,
		encoding: 'utf8',
	} );

	if ( result.status !== 0 ) {
		throw new Error(
			`wp ${ args[ 0 ] } failed:\n${ result.stderr || result.stdout }`
		);
	}

	return result.stdout.trim();
}

const sleep = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

/**
 * Laragon links the plugins into the test site, and Simply Static refuses
 * files whose real path is outside the site: the export gets real copies.
 *
 * @return {() => void} Restores the links.
 */
const stageCopies = () =>
	MODE === 'wp-env'
		? () => {}
		: stagePluginCopies( process.env.WP_TESTS_PATH ?? '' );

/**
 * When Simply Static's last export ended.
 *
 * @return {string} Date, or ''.
 */
function endTime() {
	return wp( [
		'eval',
		"$o = get_option( 'simply-static', array() ); echo isset( $o['archive_end_time'] ) ? (string) $o['archive_end_time'] : '';",
	] );
}

/**
 * Runs the Simply Static export and waits for it to finish.
 *
 * @param {Object<string, string>} paths Fixture page paths, by slug.
 */
async function exportSite( paths ) {
	// Clear a job left behind by an interrupted run.
	wp( [
		'eval',
		`$job = Simply_Static\\Plugin::instance()->get_archive_creation_job();
		$job->delete_all();
		delete_site_transient( 'wp_archive_creation_job_process_lock' );
		delete_option( Simply_Static\\Plugin::EXPORT_START_LOCK_OPTION );`,
	] );

	// Configure in one process and start in another: Simply Static reads its
	// options once per request. Only the home page and the fixture pages are
	// crawled; assets come from what those pages reference, plus Modal Kit's
	// runtime folder (Integrations/SimplyStatic.php). Smart Crawl (on by
	// default since Simply Static 3.8) queues all of wp-includes, which runs
	// past PHP's time limit, so it is off.
	const urls = Object.values( paths )
		.map( ( path ) => `home_url( '${ path }' )` )
		.join( ', ' );
	wp( [
		'eval',
		`$o = get_option( 'simply-static', array() );
		$o['smart_crawl'] = false;
		$o['additional_urls'] = implode( "\\n", array( ${ urls } ) );
		// Core loads its emoji scripts from inline settings, so nothing links them.
		$o['additional_files'] = implode( "\\n", array(
			ABSPATH . WPINC . '/js/twemoji.js',
			ABSPATH . WPINC . '/js/wp-emoji.js',
			ABSPATH . WPINC . '/js/wp-emoji-release.min.js',
		) );
		$o['delivery_method'] = 'local';
		$o['local_dir'] = '${ EXPORT_IN_SITE }/';
		$o['destination_url_type'] = 'relative';
		$o['relative_path'] = '';
		$o['clear_directory_before_export'] = true;
		$o['crawlers'] = array( 'home', 'post_type' );
		$o['post_types'] = array( 'page' );
		$o['post_types_configured'] = true;
		update_option( 'simply-static', $o );`,
	] );

	// An export counts as running while it has a start time and no end time,
	// so the end time is left alone: done = a new end time appears.
	const previousEnd = endTime();
	const started = wp( [
		'eval',
		'echo Simply_Static\\Plugin::instance()->run_static_export() ? "started" : "blocked";',
	] );

	if ( started !== 'started' ) {
		throw new Error( 'Simply Static did not start the export.' );
	}

	const deadline = Date.now() + 10 * 60 * 1000;

	for (;;) {
		await sleep( 3000 );

		const end = endTime();

		if ( end && end !== previousEnd ) {
			return;
		}

		if ( Date.now() > deadline ) {
			throw new Error(
				'Simply Static export timed out after 10 minutes.'
			);
		}
	}
}

async function main() {
	rmSync( EXPORT_DIR, { recursive: true, force: true } );
	mkdirSync( EXPORT_DIR, { recursive: true } );

	console.log( '› Activating plugins and seeding fixtures' );
	wp( [ 'plugin', 'activate', 'modal-kit', 'simply-static', '--quiet' ] );
	const seed = ( slug ) =>
		JSON.parse(
			wp( [
				'eval-file',
				`${ pluginInSite( slug ) }/tests/static/fixtures.php`,
			] )
				.split( '\n' )
				.pop()
		);
	const paths = seed( 'modal-kit' );

	console.log( '› Exporting with Simply Static' );
	const restore = stageCopies();
	try {
		if ( MODE !== 'wp-env' && process.env.WP_BASE_URL ) {
			await waitForPluginUrls(
				new URL(
					paths[ 'static-home' ] ?? '/',
					process.env.WP_BASE_URL
				).href
			);
		}
		await exportSite( paths );
	} finally {
		restore();
		// The export is written: its fixture pages and modals would otherwise
		// stay on the test site and shift the e2e suites' screenshots.
		wp( [
			'eval',
			'foreach ( get_posts( array( "post_type" => array( "page", "mk_modal" ), "post_status" => "any", "posts_per_page" => -1, "meta_key" => "_modal_kit_static_fixture", "fields" => "ids" ) ) as $id ) { wp_delete_post( $id, true ); }',
		] );
	}

	console.log( `› Serving ${ EXPORT_DIR } on http://localhost:${ PORT }` );
	const server = await serve( EXPORT_DIR, PORT );

	// Async: the server lives in this process, so the event loop must stay free.
	const status = await new Promise( ( done ) => {
		spawn(
			'npx playwright test --config tests/static/playwright.config.js',
			{
				cwd: ROOT,
				shell: true,
				stdio: 'inherit',
				env: {
					...process.env,
					STATIC_BASE_URL: `http://localhost:${ PORT }`,
					STATIC_PATHS: JSON.stringify( paths ),
				},
			}
		).on( 'close', ( code ) => done( code ?? 1 ) );
	} );

	server.close();
	process.exitCode = status;
}

main().catch( ( error ) => {
	console.error( error.message );
	process.exitCode = 1;
} );

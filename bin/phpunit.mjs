/**
 * Runs PHPUnit with the WordPress test library. Locally the library and PHP
 * come from Laragon (.env); in CI from WP_TESTS_DIR and the PATH.
 */
import { join } from 'node:path';
import { ROOT, loadEnv, run } from './lib.mjs';

loadEnv();

const php = process.env.PHP_BINARY || 'php';
const phpunit = join( ROOT, 'vendor/phpunit/phpunit/phpunit' );
const args = process.argv.slice( 2 );

// The WordPress test library installs a network when WP_MULTISITE is set.
if ( args.includes( '--multisite' ) ) {
	process.env.WP_MULTISITE = '1';
}

process.exit(
	run( php, [ phpunit, ...args.filter( ( arg ) => arg !== '--multisite' ) ] )
);

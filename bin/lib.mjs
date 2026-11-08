/**
 * Shared helpers for the bin scripts: .env loading and process spawning.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '..' );

export const PLUGINS = [ 'modal-kit' ];

/**
 * A plugin's source folder: this repo.
 *
 * @return {string} Folder.
 */
export const pluginDir = () => ROOT;

/**
 * The version in a plugin's header.
 *
 * @param {string} slug Plugin slug.
 * @return {string} Version.
 */
export function pluginVersion( slug ) {
	const file = join( pluginDir( slug ), `${ slug }.php` );
	const match = readFileSync( file, 'utf8' ).match(
		/^[\s*]*Version:\s*(\S+)/m
	);

	if ( ! match ) {
		throw new Error( `No Version header in ${ file }` );
	}

	return match[ 1 ];
}

/**
 * Where a plugin's zip for its current version goes.
 *
 * @param {string} slug Plugin slug.
 * @return {string} Path.
 */
export const releaseZip = ( slug ) =>
	join(
		pluginDir( slug ),
		'releases',
		`${ slug }-${ pluginVersion( slug ) }.zip`
	);

/**
 * Loads .env into process.env without overriding variables already set.
 *
 * @return {boolean} Whether a .env file was found.
 */
export function loadEnv() {
	const file = join( ROOT, '.env' );

	if ( ! existsSync( file ) ) {
		return false;
	}

	process.loadEnvFile( file );

	return true;
}

/**
 * Runs a command, streaming its output, and returns the exit code.
 *
 * @param {string}   command Executable.
 * @param {string[]} args    Arguments.
 * @param {Object}   options spawnSync options.
 * @return {number} Exit code.
 */
export function run( command, args, options = {} ) {
	const result = spawnSync( command, args, {
		stdio: 'inherit',
		cwd: ROOT,
		...options,
	} );

	if ( result.error ) {
		// eslint-disable-next-line no-console
		console.error( result.error.message );
		return 1;
	}

	return result.status ?? 1;
}

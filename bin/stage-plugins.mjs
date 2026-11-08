/**
 * Real copies of the plugins in a Laragon site, in place of the links into
 * the repo that `npm run env:start` makes, for suites that need the files
 * where a real install has them: Simply Static refuses files outside the
 * site, and optimisers that rewrite url() in combined CSS work them out from
 * the file's real path (bin/test-static.mjs, bin/test-cache.mjs).
 */
import { cpSync, lstatSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pluginDir } from './lib.mjs';

/* eslint-disable no-console */

// What each plugin's zip holds: the files a real install has.
export const PLUGIN_FILES = {
	'modal-kit': [
		'modal-kit.php',
		'uninstall.php',
		'includes',
		'build',
		'assets',
		'schema',
		'patterns',
	],
};

function isLink( path ) {
	try {
		return lstatSync( path ).isSymbolicLink();
	} catch {
		return false;
	}
}

/**
 * Swaps each linked plugin for a copy of its built files.
 *
 * @param {string} site Site folder.
 * @return {() => void} Puts the links back.
 */
export function stagePluginCopies( site ) {
	const restores = Object.entries( PLUGIN_FILES ).map(
		( [ slug, entries ] ) => {
			const inSite = join( site, `wp-content/plugins/${ slug }` );

			if ( ! isLink( inSite ) ) {
				return () => {};
			}

			const target = pluginDir( slug );

			rmSync( inSite, { force: true } );
			for ( const entry of entries ) {
				cpSync( join( target, entry ), join( inSite, entry ), {
					recursive: true,
				} );
			}

			return () => {
				rmSync( inSite, { recursive: true, force: true } );
				symlinkSync( target, inSite, 'junction' );
			};
		}
	);

	return () => restores.forEach( ( restore ) => restore() );
}

/**
 * Puts the links back where a plugin is a staged copy (after a run that was
 * stopped or held).
 *
 * @param {string} site Site folder.
 */
export function linkPlugins( site ) {
	for ( const slug of Object.keys( PLUGIN_FILES ) ) {
		const inSite = join( site, `wp-content/plugins/${ slug }` );

		if ( ! isLink( inSite ) ) {
			rmSync( inSite, { recursive: true, force: true } );
			symlinkSync( pluginDir( slug ), inSite, 'junction' );
		}
	}
}

/**
 * After the plugins are swapped for real copies, Apache's PHP may still
 * resolve their files through the old link for a while (its realpath cache
 * lasts up to two minutes per worker, and an e2e run just before keeps it
 * warm), which builds plugin URLs from the repo path. Waits until the page
 * links the plugin files from wp-content/plugins/.
 *
 * @param {string} url A page with a modal.
 * @return {Promise<void>}
 */
export async function waitForPluginUrls( url ) {
	const until = Date.now() + 180000;

	while ( Date.now() < until ) {
		const html = await fetch( url, { cache: 'no-store' } )
			.then( ( response ) => response.text() )
			.catch( () => '' );

		if (
			html.includes( '/wp-content/plugins/modal-kit/build/' ) &&
			! /\/wp-content\/plugins\/[A-Za-z]:?\//.test( html )
		) {
			return;
		}

		await new Promise( ( done ) => setTimeout( done, 5000 ) );
	}

	console.warn( '  Plugin URLs still point at the link; going on anyway.' );
}

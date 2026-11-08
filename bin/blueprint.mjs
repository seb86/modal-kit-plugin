/**
 * Builds the WordPress.org "Live Preview" blueprint for the free plugin:
 * .wordpress-org/blueprints/blueprint.json, which goes to the plugin's
 * SVN assets/blueprints/ folder. The demo content is bin/blueprint/demo.php,
 * embedded as a runPHP step.
 *
 *   npm run wporg:blueprint            write the blueprint
 *   npm run wporg:blueprint -- --local also write a test bundle in
 *                                      artifacts/blueprint/ that installs the
 *                                      local zip (npm run plugin-zip first)
 *
 * Try the bundle with:
 *   `npx @wp-playground/cli server --blueprint=artifacts/blueprint/ --blueprint-may-read-adjacent-files`
 */
/* eslint-disable no-console */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { releaseZip } from './lib.mjs';

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const OUT = join( ROOT, '.wordpress-org/blueprints/blueprint.json' );
const LOCAL = join( ROOT, 'artifacts/blueprint' );
const ZIP = releaseZip( 'modal-kit' );

/**
 * The blueprint, installing the plugin from the given resource.
 *
 * @param {Object} plugin Plugin resource.
 * @return {Object} Blueprint.
 */
export function blueprint( plugin ) {
	return {
		$schema: 'https://playground.wordpress.net/blueprint-schema.json',
		meta: {
			title: 'Modal Kit',
			author: 'Sébastien Dumont',
			description:
				'Every free starter as a modal, on a front page with a button for each.',
		},
		landingPage: '/',
		preferredVersions: { php: '8.3', wp: 'latest' },
		features: { networking: true },
		login: true,
		steps: [
			{
				step: 'installPlugin',
				pluginData: plugin,
				options: { activate: true },
			},
			{
				step: 'runPHP',
				code: readFileSync(
					join( ROOT, 'bin/blueprint/demo.php' ),
					'utf8'
				).replace( /\r\n/g, '\n' ),
			},
		],
	};
}

const write = ( file, data ) => {
	mkdirSync( dirname( file ), { recursive: true } );
	writeFileSync( file, JSON.stringify( data, null, '\t' ) + '\n' );
	console.log( `Wrote ${ file }` );
};

write(
	OUT,
	blueprint( { resource: 'wordpress.org/plugins', slug: 'modal-kit' } )
);

if ( process.argv.includes( '--local' ) ) {
	if ( ! existsSync( ZIP ) ) {
		console.error( `No ${ ZIP }: run npm run plugin-zip first.` );
		process.exit( 1 );
	}

	mkdirSync( LOCAL, { recursive: true } );
	copyFileSync( ZIP, join( LOCAL, 'modal-kit.zip' ) );
	write(
		join( LOCAL, 'blueprint.json' ),
		blueprint( { resource: 'bundled', path: '/modal-kit.zip' } )
	);
}

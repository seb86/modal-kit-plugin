/**
 * Moves the zip `wp-scripts plugin-zip` wrote to releases/<slug>-<version>.zip,
 * replacing any zip of the same version. The folder inside the zip keeps the
 * plain slug, so WordPress installs it in the usual place.
 *
 * npm's file list always adds package.json and the root README.md. A live
 * site needs neither, so they come out here. Pro has no readme.txt and keeps
 * its README.md: its repo is private, so the zip is where customers read it.
 *
 *   npm run plugin-zip
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import AdmZip from 'adm-zip';
import { ROOT, releaseZip } from './lib.mjs';

/* eslint-disable no-console */

const { name: slug } = JSON.parse(
	readFileSync( join( ROOT, 'package.json' ), 'utf8' )
);
const target = releaseZip( slug );
const built = join( ROOT, `${ slug }.zip` );
const zip = new AdmZip( built );

zip.deleteFile( `${ slug }/package.json` );

if ( existsSync( join( ROOT, 'readme.txt' ) ) ) {
	zip.deleteFile( `${ slug }/README.md` );
}

mkdirSync( dirname( target ), { recursive: true } );
rmSync( target, { force: true } );
zip.writeZip( target );
rmSync( built );

console.log( `\nWrote ${ relative( ROOT, target ) }` );

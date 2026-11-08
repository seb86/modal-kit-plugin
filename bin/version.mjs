/**
 * Copies the version and requirements in package.json to everywhere else that
 * states them, so package.json is the only place to change them.
 *
 *   npm version 1.2.3    Sets the version and runs this (the `version` script).
 *   npm run version      Runs this after editing package.json by hand.
 *   npm run stable       Sets the readme's Stable tag, and nothing else.
 *
 * The Stable tag is separate because it decides what WordPress.org gives
 * people, so moving it is a release decision. WordPress.org's Stable tag takes
 * numbers and periods only, so a pre-release can't become one.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/* eslint-disable no-console */

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const pkg = JSON.parse( readFileSync( join( ROOT, 'package.json' ), 'utf8' ) );
const { name, version } = pkg;

/**
 * Stops with a message.
 *
 * @param {string} message What went wrong.
 */
function fail( message ) {
	console.error( `\n${ message }\n` );
	process.exit( 1 );
}

if ( ! /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test( version ) ) {
	fail( `"${ version }" isn't a version such as 1.2.3 or 1.2.3-beta.1.` );
}

/**
 * Replaces each pattern's value in a file. A pattern that finds nothing stops
 * the run, so a moved or renamed line can't be skipped without anyone noticing.
 *
 * @param {string}                  file  Path relative to the plugin.
 * @param {Array<[RegExp, string]>} rules Pattern with the prefix as group 1, and its value.
 */
function update( file, rules ) {
	const path = join( ROOT, file );
	const before = readFileSync( path, 'utf8' );
	let after = before;

	for ( const [ pattern, value ] of rules ) {
		if ( ! pattern.test( after ) ) {
			fail( `Nothing matches ${ pattern } in ${ file }.` );
		}

		after = after.replace( pattern, ( _, prefix ) => prefix + value );
	}

	if ( after !== before ) {
		writeFileSync( path, after );
		console.log( `Updated ${ file }` );
	}
}

/**
 * Every block.json under a folder.
 *
 * @param {string} dir Folder.
 * @return {string[]} Paths.
 */
function blockFiles( dir ) {
	return readdirSync( dir, { withFileTypes: true } ).flatMap( ( entry ) => {
		const path = join( dir, entry.name );

		if ( entry.isDirectory() ) {
			return blockFiles( path );
		}

		return entry.name === 'block.json' ? [ path ] : [];
	} );
}

if ( process.argv.includes( '--stable' ) ) {
	if ( ! existsSync( join( ROOT, 'readme.txt' ) ) ) {
		fail( `${ name } has no readme.txt, so it has no Stable tag.` );
	}

	if ( ! /^[\d.]+$/.test( version ) ) {
		fail(
			`${ version } is a pre-release, and a Stable tag takes numbers and periods only. Stable tag left as it was.`
		);
	}

	update( 'readme.txt', [ [ /^(Stable tag:\s*)\S+/m, version ] ] );
	console.log( `Stable tag is ${ version }` );
	process.exit( 0 );
}

const constant = `${ name.toUpperCase().replace( /-/g, '_' ) }_VERSION`;
const requirements = [
	[ /^( \* Requires at least:\s*)\S+/m, pkg.requires ],
	[ /^( \* Requires PHP:\s*)\S+/m, pkg.requires_php ],
];

update( `${ name }.php`, [
	[ /^( \* Version:\s*)\S+/m, version ],
	[ new RegExp( `(define\\( '${ constant }', ')[^']+` ), version ],
	...requirements,
	...( pkg.modal_kit_tested_up_to
		? [
				[
					/^( \* Modal Kit tested up to:\s*)\S+/m,
					pkg.modal_kit_tested_up_to,
				],
			]
		: [] ),
] );

if ( existsSync( join( ROOT, 'readme.txt' ) ) ) {
	update( 'readme.txt', [
		[ /^(Requires at least:\s*)\S+/m, pkg.requires ],
		[ /^(Tested up to:\s*)\S+/m, pkg.tested_up_to ],
		[ /^(Requires PHP:\s*)\S+/m, pkg.requires_php ],
	] );
}

for ( const file of blockFiles( join( ROOT, 'src' ) ) ) {
	update( relative( ROOT, file ), [
		[ /^(\s*"version": ")[^"]+/m, version ],
	] );
}

update( `languages/${ name }.pot`, [
	[ /^("Project-Id-Version: .+ )[^ \\]+/m, version ],
] );

update( 'README.md', [
	[ /(img\.shields\.io\/badge\/WordPress-)[\d.]+/, pkg.requires ],
	[ /(alt="WordPress )[\d.]+/, pkg.requires ],
	[ /(img\.shields\.io\/badge\/PHP-)[\d.]+/, pkg.requires_php ],
	[ /(alt="PHP )[\d.]+/, pkg.requires_php ],
	[ /(Requires WordPress )[\d.]+/, pkg.requires ],
	[ /(Requires WordPress [\d.]+\+(?: and|,) PHP )[\d.]+/, pkg.requires_php ],
] );

// The same as `npm version` does, for when package.json was edited by hand.
update( 'package-lock.json', [
	[ /^(\s*"version": ")[^"]+/m, version ],
	[ /("packages":\s*\{\s*"":\s*\{[^}]*?"version": ")[^"]+/, version ],
] );

console.log( `${ name } is at ${ version }` );

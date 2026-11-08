/**
 * Style import and export (S2, plan §3.6): the schema, the sanitiser, the
 * contrast block, clash naming and the export format. includes/StyleSchema.php
 * mirrors this; tests/phpunit/StyleLibraryTest.php checks the PHP side.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
	contrastCheck,
	exportJson,
	freeSlug,
	readStyle,
	sanitizeValue,
	slugify,
} from '../../src/styles/schema';

const file = ( slug ) =>
	readFileSync(
		new URL( `../../src/styles/${ slug }.json`, import.meta.url ),
		'utf8'
	).replace( /\r\n/g, '\n' );

describe( 'sanitizeValue', () => {
	it.each( [
		[ 'color', '#B4472B' ],
		[ 'color', 'rgba(24,20,48,.5)' ],
		[ 'length', '12px' ],
		[ 'length', '-0.02em' ],
		[ 'family', "'Recoleta', Georgia, serif" ],
		[ 'shadow', '0 24px 60px rgba(24,20,48,.28)' ],
		[ 'shadow', '0 0 0 1px #3a3646, 0 30px 80px rgba(0,0,0,.5)' ],
	] )( 'keeps a %s: %s', ( kind, value ) => {
		expect( sanitizeValue( kind, value ) ).toBe( value );
	} );

	it.each( [
		[ 'color', 'url(https://evil.example/x.png)' ],
		[ 'color', 'expression(alert(1))' ],
		[ 'color', '#fff; background: red' ],
		[ 'color', '#fff}body{display:none' ],
		[ 'color', 'red' ],
		[ 'length', '12px; color: red' ],
		[ 'family', 'Inter} .x{' ],
		[ 'shadow', '0 0 4px url(x)' ],
		[ 'shadow', '0 0 4px var(--x)' ],
		[ 'shadow', '0 0 4px expression(1)' ],
	] )( 'rejects a %s: %s', ( kind, value ) => {
		expect( sanitizeValue( kind, value ) ).toBeUndefined();
	} );

	it( 'keeps weights and sizes in range', () => {
		expect( sanitizeValue( 'weight', 600 ) ).toBe( 600 );
		expect( sanitizeValue( 'weight', '700' ) ).toBe( 700 );
		expect( sanitizeValue( 'weight', 950 ) ).toBeUndefined();
		expect( sanitizeValue( 'size', 30 ) ).toBe( 30 );
		expect( sanitizeValue( 'size', 400 ) ).toBeUndefined();
	} );
} );

describe( 'readStyle', () => {
	it( 'fills what’s missing from Fieldnote and lists it', () => {
		const result = readStyle( {
			label: 'Terracotta',
			color: { surface: '#FFFAF6', ink: '#3B2219', accent: '#B4472B' },
		} );

		expect( result.error ).toBe( '' );
		expect( result.style.slug ).toBe( 'terracotta' );
		expect( result.style.color.surface ).toBe( '#FFFAF6' );
		expect( result.style.color.muted ).toBe( '#55536A' );
		expect( result.found.color ).toBe( 3 );
		expect( result.missing ).toContain( 'shadow' );
		expect( result.missing ).toContain( 'color.tint' );
	} );

	it( 'ignores unknown keys and replaces values that aren’t colours or lengths', () => {
		const result = readStyle( {
			label: 'Odd',
			script: 'alert(1)',
			color: { surface: 'url(x)', glow: '#fff' },
		} );

		expect( result.ignored ).toEqual( [ 'script', 'color.glow' ] );
		expect( result.invalid ).toEqual( [ 'color.surface' ] );
		expect( result.style.color.surface ).toBe( '#FFFFFF' );
		expect( result.style ).not.toHaveProperty( 'script' );
	} );

	it( 'needs a name, and an object', () => {
		expect( readStyle( { color: {} } ).error ).toBe( 'no-name' );
		expect( readStyle( [ 1, 2 ] ).error ).toBe( 'not-a-style' );
		expect( readStyle( 'nope' ).error ).toBe( 'not-a-style' );
	} );
} );

describe( 'contrastCheck', () => {
	it( 'passes the built-in styles and reports the summary ratios', () => {
		for ( const slug of [ 'fieldnote', 'harbor', 'night' ] ) {
			const result = contrastCheck(
				readStyle( JSON.parse( file( slug ) ) ).style
			);

			expect( result.pass ).toBe( true );
			expect( result.summary.body ).toBeGreaterThanOrEqual( 4.5 );
		}
	} );

	it( 'blocks a style whose text is hard to read', () => {
		const { style } = readStyle( {
			label: 'Faint',
			color: { surface: '#ffffff', ink: '#cccccc' },
		} );
		const result = contrastCheck( style );

		expect( result.pass ).toBe( false );
		expect( result.failures[ 0 ] ).toMatchObject( {
			fg: 'ink',
			bg: 'surface',
		} );
	} );
} );

describe( 'names and export', () => {
	it( 'imports a taken name as a copy: Terracotta 2, then 3', () => {
		expect( freeSlug( 'terracotta', 'Terracotta', [ 'night' ] ) ).toEqual( {
			slug: 'terracotta',
			label: 'Terracotta',
		} );
		expect(
			freeSlug( 'terracotta', 'Terracotta', [
				'terracotta',
				'terracotta-2',
			] )
		).toEqual( { slug: 'terracotta-3', label: 'Terracotta 3' } );
		expect( freeSlug( 'soft', 'Soft', [ 'default', 'soft' ] ).slug ).toBe(
			'soft-2'
		);
	} );

	it( 'slugs names', () => {
		expect( slugify( 'Café Noir!' ) ).toBe( 'cafe-noir' );
	} );

	it.each( [ 'fieldnote', 'harbor', 'night' ] )(
		'exports %s exactly as its file',
		( slug ) => {
			const text = file( slug );

			expect( exportJson( readStyle( JSON.parse( text ) ).style ) ).toBe(
				text
			);
		}
	);
} );

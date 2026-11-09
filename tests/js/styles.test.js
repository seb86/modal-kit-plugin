/**
 * Fixed styles: every style JSON keeps its text readable and its
 * field borders and focus rings visible, and the compiled token rules are up
 * to date with the JSON files.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { OUTPUT, readStyles, scss, tokens } from '../../bin/build-styles.mjs';
import { accentProblem, contrast, textOn } from '../../src/styles/contrast';

const styles = readStyles();

// [foreground, background, minimum ratio]: 4.5 for text, 3 for UI.
const PAIRS = [
	[ 'ink', 'surface', 4.5 ],
	[ 'muted', 'surface', 4.5 ],
	[ 'accent', 'surface', 4.5 ],
	[ 'accent-strong', 'surface', 4.5 ],
	[ 'on-accent', 'accent', 4.5 ],
	[ 'on-accent', 'accent-strong', 4.5 ],
	[ 'muted', 'tint', 4.5 ],
	[ 'full-ink', 'full-bg', 4.5 ],
	[ 'full-accent', 'full-bg', 4.5 ],
	[ 'field', 'surface', 3 ],
	// The focus ring is the accent.
	[ 'accent', 'surface', 3 ],
];

describe( 'fixed styles', () => {
	it( 'ships Fieldnote, Harbor and Night', () => {
		expect( styles.map( ( style ) => style.slug ) ).toEqual( [
			'fieldnote',
			'harbor',
			'night',
		] );
	} );

	describe.each( styles.map( ( style ) => [ style.slug, style ] ) )(
		'%s',
		( slug, style ) => {
			it.each( PAIRS )( '%s on %s ≥ %s:1', ( fg, bg, min ) => {
				expect(
					contrast( style.color[ fg ], style.color[ bg ] )
				).toBeGreaterThanOrEqual( min );
			} );

			it( 'full-screen buttons are readable', () => {
				const values = Object.fromEntries( tokens( style ) );

				expect(
					contrast(
						values[ '--mk-on-full-button' ],
						values[ '--mk-full-button' ]
					)
				).toBeGreaterThanOrEqual( 4.5 );
			} );

			it( 'has a label and the tokens every layout reads', () => {
				const names = tokens( style ).map( ( [ name ] ) => name );

				expect( style.label ).toBeTruthy();
				expect( names ).toEqual(
					expect.arrayContaining( [
						'--mk-surface',
						'--mk-ink',
						'--mk-accent',
						'--mk-overlay',
						'--mk-font-head',
						'--mk-font-body',
						'--mk-radius-panel',
						'--mk-radius-button',
						'--mk-radius-field',
						'--mk-shadow',
					] )
				);
			} );
		}
	);

	it( 'the compiled token rules match the JSON files (run `npm run build`)', () => {
		expect( readFileSync( OUTPUT, 'utf8' ).replace( /\r\n/g, '\n' ) ).toBe(
			scss( styles )
		);
	} );

	it( 'keeps only the overlay color; the modal sets its opacity', () => {
		const night = Object.fromEntries(
			tokens( styles.find( ( style ) => style.slug === 'night' ) )
		);

		expect( night[ '--mk-overlay' ] ).toBe( 'rgb(0 0 0)' );
		expect( night[ '--mk-shadow' ] ).toBe(
			'0 0 0 1px #3a3646, 0 30px 80px rgb(0 0 0 / 50%)'
		);
	} );
} );

describe( 'custom accent', () => {
	it( 'picks light or dark text, whichever reads better', () => {
		expect( textOn( '#5e45cd', '#fff', '#17151f' ) ).toBe( '#fff' );
		expect( textOn( '#ffcc00', '#fff', '#17151f' ) ).toBe( '#17151f' );
	} );

	it( 'warns below 4.5:1 against its text or the panel', () => {
		expect( accentProblem( '#5e45cd', '#ffffff' ) ).toBeNull();
		// Light yellow: fine for button text, unreadable as text on white.
		expect( accentProblem( '#ffcc00', '#ffffff' ) ).toBeLessThan( 4.5 );
		expect( accentProblem( '', '#ffffff' ) ).toBeNull();
	} );
} );

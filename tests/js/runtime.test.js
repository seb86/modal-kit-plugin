// @vitest-environment jsdom

/**
 * Runtime helpers: URL matching, link resolution, storage, visit timing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { urlMatches } from '../../src/runtime/triggers/url';
import { slugFromUrl } from '../../src/runtime/links';
import { registerModal } from '../../src/runtime/modals';
import {
	clearAll,
	read,
	remove,
	storageKey,
	write,
} from '../../src/runtime/storage';
import { visitSeconds } from '../../src/runtime/triggers/time';

describe( 'urlMatches', () => {
	const at = ( href ) => new URL( href, 'https://example.org/shop/' );

	it.each( [
		[ 'utm_campaign=autumn', '?utm_campaign=autumn', true ],
		[ 'utm_campaign=autumn', '?utm_campaign=spring', false ],
		[ 'utm_campaign', '?utm_campaign=anything', true ],
		[ '?ref=mail', '?ref=mail&x=1', true ],
		[ '#offer', '#offer', true ],
		[ '#offer', '#other', false ],
		[ '', '?a=b', false ],
	] )( '%s on %s → %s', ( value, href, expected ) => {
		expect( urlMatches( value, at( href ) ) ).toBe( expected );
	} );
} );

describe( 'slugFromUrl', () => {
	beforeEach( () => {
		window.history.replaceState( null, '', '/shop/' );
		const dialog = document.createElement( 'dialog' );
		dialog.id = 'modal-autumn-sale';
		document.body.append( dialog );
		registerModal( dialog, { slug: 'autumn-sale', layout: 'centered' } );
	} );

	it( 'reads #prefix-slug and ?modal=slug on the same page', () => {
		expect( slugFromUrl( '#modal-autumn-sale', 'modal-' ) ).toBe(
			'autumn-sale'
		);
		expect( slugFromUrl( '/shop/?modal=autumn-sale', 'modal-' ) ).toBe(
			'autumn-sale'
		);
	} );

	it( 'supports an empty prefix', () => {
		expect( slugFromUrl( '#autumn-sale', '' ) ).toBe( 'autumn-sale' );
	} );

	it( 'ignores other pages, other sites and unknown modals', () => {
		expect( slugFromUrl( '/journal/#modal-autumn-sale', 'modal-' ) ).toBe(
			null
		);
		expect(
			slugFromUrl(
				'https://elsewhere.test/shop/#modal-autumn-sale',
				'modal-'
			)
		).toBe( null );
		expect( slugFromUrl( '#modal-nope', 'modal-' ) ).toBe( null );
		expect( slugFromUrl( '#heading', 'modal-' ) ).toBe( null );
	} );
} );

describe( 'storage', () => {
	afterEach( () => window.localStorage.clear() );

	it( 'namespaces keys under modal-kit:', () => {
		write( 'seen', { a: 1 } );

		expect( window.localStorage.getItem( 'modal-kit:seen' ) ).toBe(
			'{"a":1}'
		);
		expect( read( 'seen' ) ).toEqual( { a: 1 } );
	} );

	it( 'returns the fallback for missing or broken values', () => {
		window.localStorage.setItem( 'modal-kit:broken', '{nope' );

		expect( read( 'missing', 'x' ) ).toBe( 'x' );
		expect( read( 'broken', 'y' ) ).toBe( 'y' );
	} );

	it( 'clears only its own keys', () => {
		write( 'a', 1 );
		window.localStorage.setItem( 'other', '1' );
		remove( 'missing' );
		clearAll();

		expect( read( 'a' ) ).toBe( null );
		expect( window.localStorage.getItem( 'other' ) ).toBe( '1' );
	} );
} );

describe( 'storage on a site in a subfolder', () => {
	const inSubfolder = ( scope ) => {
		const meta = document.createElement( 'meta' );

		meta.name = 'modal-kit-scope';
		meta.content = scope;
		document.head.append( meta );
	};

	afterEach( () => {
		window.localStorage.clear();
		document.head
			.querySelectorAll( 'meta[name="modal-kit-scope"]' )
			.forEach( ( meta ) => meta.remove() );
	} );

	it( 'keeps each site apart under its path', () => {
		write( 'seen', 'root' );
		inSubfolder( '/site2/' );

		expect( storageKey( 'seen' ) ).toBe( 'modal-kit:/site2/seen' );
		expect( read( 'seen' ) ).toBe( null );

		write( 'seen', 'two' );

		expect( read( 'seen' ) ).toBe( 'two' );
		expect( window.localStorage.getItem( 'modal-kit:seen' ) ).toBe(
			'"root"'
		);
		expect( window.localStorage.getItem( 'modal-kit:/site2/seen' ) ).toBe(
			'"two"'
		);
	} );

	it( 'clears only this site, from a subfolder and from the root', () => {
		window.localStorage.setItem( 'modal-kit:seen', '1' );
		window.localStorage.setItem( 'modal-kit:/site2/seen', '2' );
		window.localStorage.setItem( 'modal-kit:/site3/seen', '3' );

		inSubfolder( '/site2/' );
		clearAll();

		expect( window.localStorage.getItem( 'modal-kit:seen' ) ).toBe( '1' );
		expect( window.localStorage.getItem( 'modal-kit:/site2/seen' ) ).toBe(
			null
		);
		expect( window.localStorage.getItem( 'modal-kit:/site3/seen' ) ).toBe(
			'3'
		);

		document.head.querySelector( 'meta[name="modal-kit-scope"]' ).remove();
		clearAll();

		expect( window.localStorage.getItem( 'modal-kit:seen' ) ).toBe( null );
		expect( window.localStorage.getItem( 'modal-kit:/site3/seen' ) ).toBe(
			'3'
		);
	} );
} );

describe( 'visitSeconds', () => {
	afterEach( () => {
		window.localStorage.clear();
		vi.useRealTimers();
	} );

	it( 'continues a visit and starts over after 30 minutes away', () => {
		vi.useFakeTimers();
		vi.setSystemTime( new Date( '2026-10-22T10:00:00Z' ) );
		write( 'visit', { seconds: 42, last: Date.now() } );

		expect( visitSeconds() ).toBe( 42 );

		vi.setSystemTime( new Date( '2026-10-22T10:31:00Z' ) );
		expect( visitSeconds() ).toBe( 0 );
	} );
} );

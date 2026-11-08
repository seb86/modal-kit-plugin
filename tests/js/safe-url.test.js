// @vitest-environment jsdom

/**
 * Only web addresses may be followed or loaded (BUILD-NOTES #188). A link's
 * video address comes from saved content, which an Author can write by hand.
 */
import { describe, expect, it } from 'vitest';

import { isWebUrl } from '../../src/runtime/safe-url';
import { playerFor } from '../../src/runtime/video';

describe( 'isWebUrl', () => {
	it.each( [
		'https://youtu.be/x',
		'http://example.com/a.mp4',
		'HTTPS://EXAMPLE.COM/',
		'/videos/a.mp4',
		'a.mp4',
		'//example.com/a.mp4',
	] )( 'allows %s', ( url ) => {
		expect( isWebUrl( url ) ).toBe( true );
	} );

	it.each( [
		'javascript:alert(1)',
		'JaVaScRiPt:alert(1)',
		' javascript:alert(1)',
		'\tjavascript:alert(1)',
		'java\nscript:alert(1)',
		'\u0001javascript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:alert(1)',
		'file:///etc/passwd',
		'',
		undefined,
		null,
	] )( 'refuses %j', ( url ) => {
		expect( isWebUrl( url ) ).toBe( false );
	} );
} );

describe( 'playerFor', () => {
	it( 'still recognises the real services and files', () => {
		expect( playerFor( 'https://youtu.be/abc' ).provider ).toBe(
			'youtube'
		);
		expect( playerFor( 'https://vimeo.com/123' ).provider ).toBe( 'vimeo' );
		expect( playerFor( 'https://example.com/a.mp4' ).provider ).toBe(
			'file'
		);
	} );

	it.each( [
		'javascript:alert(1)//a.mp4',
		'javascript://youtu.be/x%0Aalert(1)',
		'javascript://vimeo.com/123%0Aalert(1)',
		'data:video/mp4,a.mp4',
	] )( 'gives no player for %s', ( url ) => {
		expect( playerFor( url ) ).toBeNull();
	} );
} );

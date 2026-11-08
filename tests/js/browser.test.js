/**
 * Browser detection for the Browsers rule (runtime/browser.js), and the show
 * count behind "At most this many times" (runtime/visitor.js).
 */
import { describe, expect, it } from 'vitest';
import { browserFor } from '../../src/runtime/browser';
import { nextShows } from '../../src/runtime/visitor';

describe( 'browserFor', () => {
	it.each( [
		[
			'chrome',
			'Chrome on Windows',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
		],
		[
			'chrome',
			'Chrome on Android',
			'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
		],
		[
			'chrome',
			'Chrome on iPhone',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
		],
		[
			'chrome',
			'Brave (says it is Chrome)',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
		],
		[
			'safari',
			'Safari on a Mac',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
		],
		[
			'safari',
			'Safari on iPhone',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
		],
		[
			'firefox',
			'Firefox on Windows',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
		],
		[
			'firefox',
			'Firefox on iPhone',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15',
		],
		[
			'edge',
			'Edge on Windows',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
		],
		[
			'edge',
			'Edge on Android',
			'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 EdgA/141.0.0.0',
		],
		[
			'edge',
			'Edge on iPhone',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/141.0.3537.71 Mobile/15E148 Safari/605.1.15',
		],
		[
			'opera',
			'Opera',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0',
		],
		[
			'samsung',
			'Samsung Internet',
			'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
		],
		[
			'in-app',
			'Facebook on iPhone',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/530.0.0.40.104;FBBV/123]',
		],
		[
			'in-app',
			'Instagram on Android',
			'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 400.0.0.0.80 Android',
		],
		[
			'in-app',
			'Android WebView',
			'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36',
		],
		[ 'other', 'a crawler', 'Mozilla/5.0 (compatible; Bingbot/2.0)' ],
		[ 'other', 'no user agent', '' ],
	] )( '%s: %s', ( id, name, userAgent ) => {
		expect( browserFor( userAgent ) ).toBe( id );
	} );
} );

describe( 'nextShows', () => {
	it( 'counts automatic opens of the current version', () => {
		expect( nextShows( null, 'v1', true ) ).toBe( 1 );
		expect( nextShows( { version: 'v1', shows: 2 }, 'v1', true ) ).toBe(
			3
		);
	} );

	it( 'leaves the count alone for links', () => {
		expect( nextShows( { version: 'v1', shows: 2 }, 'v1', false ) ).toBe(
			2
		);
	} );

	it( 'starts over when the modal changed, even from a link', () => {
		expect( nextShows( { version: 'v1', shows: 2 }, 'v2', true ) ).toBe(
			1
		);
		expect( nextShows( { version: 'v1', shows: 2 }, 'v2', false ) ).toBe(
			0
		);
	} );
} );

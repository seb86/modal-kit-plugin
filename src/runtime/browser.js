/**
 * Which browser the visitor uses, for the Browsers rule. Read from the user
 * agent in the browser only: deciding it on the server would let a page
 * cache serve one browser's decision to every visitor.
 *
 * Order matters: Chromium browsers also say "Chrome" and "Safari", and
 * in-app browsers say whatever engine they're built on. On iOS every browser
 * is WebKit, so a browser is matched by its name (CriOS is Chrome), the way
 * site owners think of it. Brave says it's Chrome.
 */

const BROWSERS = [
	[
		'in-app',
		/FBAN|FBAV|Instagram|\bLine\/|TikTok|musical_ly|Snapchat|; wv\)/,
	],
	[ 'edge', /Edg\/|EdgA\/|EdgiOS\// ],
	[ 'opera', /OPR\/|OPiOS\// ],
	[ 'samsung', /SamsungBrowser\// ],
	[ 'firefox', /Firefox\/|FxiOS\// ],
	[ 'chrome', /CriOS\/|Chrome\/|Chromium\// ],
	[ 'safari', /Version\/[\d.]+.*Safari\// ],
];

/**
 * Browser id for a user agent.
 *
 * @param {string} userAgent User agent.
 * @return {string} chrome, safari, firefox, edge, opera, samsung, in-app or other.
 */
export function browserFor( userAgent = '' ) {
	const match = BROWSERS.find( ( [ , pattern ] ) =>
		pattern.test( userAgent )
	);

	return match ? match[ 0 ] : 'other';
}

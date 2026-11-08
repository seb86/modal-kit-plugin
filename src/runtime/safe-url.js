/**
 * Whether an address is a web address, so it's safe to follow or to load.
 * Addresses in saved content can be written by hand, and following a
 * `javascript:` one would run it on this site.
 *
 * @param {string|null|undefined} url Address, absolute or relative to this page.
 * @return {boolean} Whether it's http(s).
 */
export function isWebUrl( url ) {
	if ( typeof url !== 'string' || url === '' ) {
		return false;
	}

	try {
		const { protocol } = new URL( url, window.location.href );

		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

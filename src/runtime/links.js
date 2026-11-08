/**
 * Links open modals: #modal-{slug} (prefix from settings) and ?modal={slug}.
 * Clicks on same-page links, arriving with the hash or query, and hash
 * changes all count. Links are explicit requests, so they are never limited
 * by frequency rules.
 */
import { getModal, openModal } from './modals';

/**
 * The modal slug a URL points at on the current page, if any.
 *
 * @param {string} href    URL.
 * @param {string} prefix  Anchor prefix, e.g. "modal-".
 * @param {Object} formats Enabled link formats (Settings → General): { hash, query }.
 * @return {string|null} Slug.
 */
export function slugFromUrl(
	href,
	prefix,
	formats = { hash: true, query: true }
) {
	let url;

	try {
		url = new URL( href, window.location.href );
	} catch {
		return null;
	}

	if (
		url.origin !== window.location.origin ||
		url.pathname !== window.location.pathname
	) {
		return null;
	}

	const query = formats.query ? url.searchParams.get( 'modal' ) : null;
	if ( query && getModal( query ) ) {
		return query;
	}

	const hash = formats.hash ? decodeURIComponent( url.hash.slice( 1 ) ) : '';
	if ( hash && hash.startsWith( prefix ) ) {
		const slug = hash.slice( prefix.length );
		return getModal( slug ) ? slug : null;
	}

	return null;
}

let bound = false;

/**
 * Listens for link clicks and hash changes (once per page).
 *
 * @param {string} prefix  Anchor prefix.
 * @param {Object} formats Enabled link formats.
 */
export function bindLinks( prefix, formats ) {
	if ( bound ) {
		return;
	}

	bound = true;

	document.addEventListener( 'click', ( event ) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		const link = event.target.closest?.( 'a[href]' );
		const slug = link ? slugFromUrl( link.href, prefix, formats ) : null;

		if ( ! slug ) {
			return;
		}

		event.preventDefault();
		openModal( slug, { source: 'link', trigger: link } );
	} );

	window.addEventListener( 'hashchange', () => {
		const slug = slugFromUrl( window.location.href, prefix, formats );

		if ( slug ) {
			openModal( slug, { source: 'link' } );
		}
	} );
}

/**
 * Opens the modal the page was opened for (hash or ?modal=), if it's this one.
 *
 * @param {string} slug    Modal slug.
 * @param {string} prefix  Anchor prefix.
 * @param {Object} formats Enabled link formats.
 */
export function openFromArrival( slug, prefix, formats ) {
	if ( slugFromUrl( window.location.href, prefix, formats ) === slug ) {
		openModal( slug, { source: 'link' } );
	}
}

/**
 * Per-user dismissal of Pro listings: "Not now" hides one for 30 days,
 * "Hide this panel" for good. Stored in user meta (modal_kit_dismissed).
 */
import apiFetch from '@wordpress/api-fetch';

const DAY = 24 * 60 * 60;
const FOREVER = 4102444800; // 2100-01-01.

/**
 * Dismisses a listing for the current user.
 *
 * @param {string}  key       Listing key.
 * @param {boolean} permanent Hide for good instead of 30 days.
 * @return {Promise<void>}
 */
export function dismiss( key, permanent = false ) {
	const editor = window.modalKitEditor ?? {};
	const dismissed = {
		...( editor.dismissed ?? {} ),
		[ key ]: permanent
			? FOREVER
			: Math.floor( Date.now() / 1000 ) + 30 * DAY,
	};

	editor.dismissed = dismissed;

	return apiFetch( {
		path: '/wp/v2/users/me',
		method: 'POST',
		data: { meta: { modal_kit_dismissed: dismissed } },
	} ).catch( () => {} );
}

/**
 * Listings for one area of the editor.
 *
 * @param {string} area Area name.
 * @return {Object[]} Listings.
 */
export function listings( area ) {
	const { proListings = [], dismissed = {} } = window.modalKitEditor ?? {};
	const now = Math.floor( Date.now() / 1000 );

	return proListings.filter(
		( listing ) =>
			listing.area === area && ! ( dismissed[ listing.key ] > now )
	);
}

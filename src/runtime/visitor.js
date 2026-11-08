/**
 * What the browser remembers about the visitor, all in localStorage under
 * `modal-kit:`: the current visit (page views, time on site), each modal's
 * seen state, and the last automatic open.
 */
import { read, write } from './storage';

const VISIT_GAP = 30 * 60 * 1000;

let counted = false;

/**
 * The current visit, counting this page view once.
 *
 * @return {{id: number, views: number, seconds: number, last: number}} Visit.
 */
export function currentVisit() {
	const now = Date.now();
	let visit = read( 'visit' );

	if ( ! visit || ! visit.id || now - visit.last > VISIT_GAP ) {
		visit = { id: now, views: 0, seconds: 0, last: now };
	}

	if ( ! counted ) {
		counted = true;
		visit = { ...visit, views: ( visit.views ?? 0 ) + 1, last: now };
		write( 'visit', visit );
	}

	return visit;
}

/**
 * Seen state of a modal.
 *
 * @param {string} slug Modal slug.
 * @return {Object|null} { at, version, visit, cta }.
 */
export function seen( slug ) {
	return read( 'seen', {} )?.[ slug ] ?? null;
}

/**
 * Updates a modal's seen state.
 *
 * @param {string} slug    Modal slug.
 * @param {Object} changes Fields to set.
 */
export function markSeen( slug, changes ) {
	const all = read( 'seen', {} ) ?? {};

	all[ slug ] = { ...( all[ slug ] ?? {} ), ...changes };
	write( 'seen', all );
}

/**
 * A modal's show count after this open, for "At most this many times".
 * Only automatic opens count, and the count starts over when the modal
 * changes, like the rest of its frequency.
 *
 * @param {Object|null} previous  Seen state before this open.
 * @param {string}      version   Modal content version.
 * @param {boolean}     automatic Whether a trigger opened it (not a link).
 * @return {number} Show count.
 */
export function nextShows( previous, version, automatic ) {
	const shows = previous?.version === version ? ( previous.shows ?? 0 ) : 0;

	return shows + ( automatic ? 1 : 0 );
}

/**
 * Timestamp of the last automatic open on any page.
 *
 * @return {number|null} Timestamp.
 */
export function lastAutoOpen() {
	return read( 'last-auto-open' );
}

/**
 * Records an automatic open now.
 */
export function markAutoOpen() {
	write( 'last-auto-open', Date.now() );
}

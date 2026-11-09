/**
 * Time on site: total time across pages during this visit.
 * The running total lives in localStorage; a visit ends after 30 minutes
 * without a page view. Time only counts while the page is visible.
 */
import { read, write } from '../storage';

const KEY = 'visit';
const VISIT_GAP = 30 * 60 * 1000;
const TICK = 1000;

/**
 * Seconds spent on the site in this visit.
 *
 * @return {number} Seconds.
 */
export function visitSeconds() {
	const visit = read( KEY );

	if ( ! visit || Date.now() - visit.last > VISIT_GAP ) {
		return 0;
	}

	return visit.seconds;
}

/**
 * Stores the running total, keeping the rest of the visit record.
 *
 * @param {number} seconds Seconds on the site.
 */
function save( seconds ) {
	write( KEY, { ...( read( KEY ) ?? {} ), seconds, last: Date.now() } );
}

/**
 * @param {Object}     trigger       Settings.
 * @param {number}     trigger.delay Seconds on the site.
 * @param {() => void} fire          Opens the modal.
 * @return {() => void} Cleanup.
 */
export default function start( { delay = 30 }, fire ) {
	let seconds = visitSeconds();

	const tick = () => {
		if ( document.visibilityState !== 'visible' ) {
			return;
		}

		seconds += TICK / 1000;
		save( seconds );

		if ( seconds >= delay ) {
			fire();
		}
	};

	save( seconds );

	if ( seconds >= delay ) {
		fire();
		return () => {};
	}

	const timer = window.setInterval( tick, TICK );

	return () => window.clearInterval( timer );
}

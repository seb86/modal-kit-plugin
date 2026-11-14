/**
 * Modals start, and the page view counts, once the visitor has the page:
 *
 * - A prerendered page (speculative loading set to prerender, as Jetpack
 *   Boost does) runs its scripts before the visitor goes to it, or when they
 *   never do. It starts on `prerenderingchange`.
 * - LiteSpeed Cache's Guest Mode serves a first visit its guest page, whose
 *   script (assets/js/guest.js) declares a global `litespeed_vary` and asks
 *   the site whether to reload. Before reloading it sets `litespeed_reloaded`
 *   in sessionStorage. The page starts once that request is answered without
 *   a reload, or after a few seconds; a page about to reload never starts.
 */

// Longest wait for Guest Mode's answer.
export const GUEST_LIMIT = 3000;

// Time for Guest Mode's script to read the answer after its request ends.
export const GUEST_GRACE = 150;

const GUEST_REQUEST = 'guest.vary.php';
const GUEST_RELOADED = 'litespeed_reloaded';

const pages = new WeakMap();

/**
 * Whether Guest Mode reloaded this tab once already, or can't.
 *
 * @param {Window} win Window.
 * @return {boolean} Reloaded.
 */
function reloaded( win ) {
	try {
		return !! win.sessionStorage.getItem( GUEST_RELOADED );
	} catch {
		// Its script reads sessionStorage too, and stops without it.
		return true;
	}
}

/**
 * Whether Guest Mode's script is asking the site whether to reload.
 *
 * @param {Window} win Window.
 * @return {boolean} Asking.
 */
export function guestCheckPending( win ) {
	return (
		typeof win.litespeed_vary === 'string' &&
		! win.litespeed_vary &&
		! reloaded( win )
	);
}

/**
 * Calls back once Guest Mode's request is answered without a reload.
 *
 * @param {Window}     win  Window.
 * @param {() => void} done Callback.
 */
function afterGuestCheck( win, done ) {
	let finished = false;
	let observer = null;

	const finish = () => {
		if ( finished ) {
			return;
		}

		finished = true;
		observer?.disconnect();
		win.clearTimeout( limit );

		if ( ! reloaded( win ) ) {
			done();
		}
	};
	const limit = win.setTimeout( finish, GUEST_LIMIT );

	if ( ! win.PerformanceObserver ) {
		return;
	}

	observer = new win.PerformanceObserver( ( list ) => {
		if (
			list
				.getEntries()
				.some( ( entry ) => entry.name.includes( GUEST_REQUEST ) )
		) {
			observer.disconnect();
			win.setTimeout( finish, GUEST_GRACE );
		}
	} );

	try {
		observer.observe( { type: 'resource', buffered: true } );
	} catch {
		observer = null;
	}
}

/**
 * Resolves once the visitor has the page.
 *
 * @param {Window} win Window.
 * @return {Promise<void>} Shown.
 */
function shown( win ) {
	return new Promise( ( resolve ) => {
		const check = () =>
			guestCheckPending( win )
				? afterGuestCheck( win, resolve )
				: resolve();

		if ( win.document.prerendering ) {
			win.document.addEventListener( 'prerenderingchange', check, {
				once: true,
			} );
		} else {
			check();
		}
	} );
}

/**
 * Runs a callback once the visitor has the page. Callbacks run in the order
 * they were added.
 *
 * @param {() => void} callback What to run.
 * @param {Window}     [win]    Window.
 */
export function whenShown( callback, win = window ) {
	if ( ! pages.has( win ) ) {
		pages.set( win, shown( win ) );
	}

	pages.get( win ).then( () => callback() );
}

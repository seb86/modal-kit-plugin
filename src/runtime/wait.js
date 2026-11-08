/**
 * Add-ons that must set a modal up before its automatic triggers start
 * (Modal Kit Pro: picking an A/B variant) mark it with
 * `data-modal-kit-wait="reason"`, on the dialog or on an element inside it,
 * and remove the attribute when they're done. Whichever script runs first,
 * the triggers start once no marker is left, or after a few seconds if an
 * add-on never finishes. Links open the modal at any time.
 */

export const WAIT_LIMIT = 4000;

/**
 * Whether anything still holds the modal's triggers back.
 *
 * @param {HTMLDialogElement} dialog Dialog.
 * @return {boolean} Waiting.
 */
export function isWaiting( dialog ) {
	return (
		dialog.hasAttribute( 'data-modal-kit-wait' ) ||
		!! dialog.querySelector( '[data-modal-kit-wait]' )
	);
}

/**
 * Runs a callback once the modal isn't waiting.
 *
 * @param {HTMLDialogElement} dialog   Dialog.
 * @param {() => void}        callback What to run.
 * @param {number}            [limit]  Longest wait, in milliseconds.
 */
export function whenReady( dialog, callback, limit = WAIT_LIMIT ) {
	if ( ! isWaiting( dialog ) ) {
		callback();
		return;
	}

	let done = false;
	let timer = 0;

	const observer = new window.MutationObserver( () => {
		if ( ! isWaiting( dialog ) ) {
			finish();
		}
	} );

	function finish() {
		if ( done ) {
			return;
		}

		done = true;
		observer.disconnect();
		window.clearTimeout( timer );
		callback();
	}

	observer.observe( dialog, {
		attributes: true,
		attributeFilter: [ 'data-modal-kit-wait' ],
		subtree: true,
	} );
	timer = window.setTimeout( finish, limit );
}

/**
 * Debug logging (Settings → Tools → Debug mode, admins only). Messages are
 * prefixed [modal-kit] in the browser console.
 */

let enabled = false;

/**
 * Turns logging on or off.
 *
 * @param {boolean} value Whether to log.
 */
export function setDebug( value ) {
	enabled = !! value;
}

/**
 * Logs a message when debug mode is on.
 *
 * @param {...unknown} args Message parts.
 */
export function log( ...args ) {
	if ( enabled ) {
		// eslint-disable-next-line no-console
		console.info( '[modal-kit]', ...args );
	}
}

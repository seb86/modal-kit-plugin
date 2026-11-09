/**
 * The Copy text button action: copies, shows "Copied ✓" on
 * the button for a moment, and announces it to screen readers.
 */

let liveRegion = null;

/**
 * Announces a message politely.
 *
 * @param {string} message Message.
 */
export function announce( message ) {
	if ( ! liveRegion ) {
		liveRegion = document.createElement( 'div' );
		liveRegion.className = 'modal-kit-live';
		liveRegion.setAttribute( 'role', 'status' );
		liveRegion.setAttribute( 'aria-live', 'polite' );
		document.body.append( liveRegion );
	}

	// Clear first so repeating the same message is announced again.
	liveRegion.textContent = '';
	window.setTimeout( () => {
		liveRegion.textContent = message;
	}, 50 );
}

/**
 * Copies text with the Clipboard API, falling back to a selection copy on
 * sites without HTTPS (where the Clipboard API is unavailable).
 *
 * @param {string} text Text.
 * @return {Promise<boolean>} Whether it copied.
 */
async function writeClipboard( text ) {
	try {
		if ( window.navigator.clipboard && window.isSecureContext ) {
			await window.navigator.clipboard.writeText( text );
			return true;
		}
	} catch {}

	const field = document.createElement( 'textarea' );
	field.value = text;
	field.setAttribute( 'readonly', '' );
	field.style.position = 'fixed';
	field.style.opacity = '0';
	( document.querySelector( 'dialog[open]' ) ?? document.body ).append(
		field
	);
	field.select();

	let copied = false;
	try {
		copied = document.execCommand( 'copy' );
	} catch {}

	field.remove();

	return copied;
}

/**
 * Runs the copy action for a button.
 *
 * @param {HTMLElement} button Button element.
 * @param {string}      text   Text to copy.
 * @param {Object}      i18n   Translated strings: copied, copyFailed.
 * @return {Promise<void>}
 */
export async function copyText( button, text, i18n ) {
	const copied = await writeClipboard( text );
	const message = copied
		? ( i18n.copied ?? 'Copied ✓' )
		: ( i18n.copyFailed ?? 'Couldn’t copy.' );

	announce( message );

	if ( ! copied ) {
		return;
	}

	if ( button.dataset.modalKitLabel === undefined ) {
		button.dataset.modalKitLabel = button.textContent;
	}

	button.textContent = message;
	button.classList.add( 'is-copied' );

	window.clearTimeout( Number( button.dataset.modalKitTimer ) );
	button.dataset.modalKitTimer = String(
		window.setTimeout( () => {
			button.textContent = button.dataset.modalKitLabel;
			button.classList.remove( 'is-copied' );
		}, 2000 )
	);
}

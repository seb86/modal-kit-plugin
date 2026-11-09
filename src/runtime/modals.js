/**
 * The modal registry: opening, closing, focus, scroll lock.
 *
 * Overlay layouts open with showModal(), so the browser makes the page
 * behind inert and traps focus. Layouts that leave the page usable (corner,
 * bar, inline) open with show().
 */
import { log } from './log';

const registry = new Map();
const gates = [];
const listeners = { open: [], close: [] };

const HEADING = 'h1, h2, h3, h4, h5, h6';
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let mobileQuery = null;

/**
 * Tracks the mobile breakpoint (Settings → Display) and keeps .is-mobile on
 * every modal container in step with it.
 *
 * @param {number} breakpoint Width in px below which mobile layouts apply.
 */
export function setBreakpoint( breakpoint ) {
	if ( mobileQuery ) {
		return;
	}

	mobileQuery = window.matchMedia( `(max-width: ${ breakpoint - 0.02 }px)` );

	const apply = () =>
		registry.forEach( ( { dialog } ) =>
			dialog.classList.toggle( 'is-mobile', mobileQuery.matches )
		);

	mobileQuery.addEventListener( 'change', apply );
}

/**
 * Registers a printed modal.
 *
 * @param {HTMLDialogElement} dialog Dialog element.
 * @param {Object}            config Context from the server.
 * @return {Object} Registry entry.
 */
export function registerModal( dialog, config ) {
	const entry = { dialog, config, returnFocus: null, source: null };

	registry.set( config.slug, entry );
	dialog.addEventListener( 'close', () => onClosed( entry ) );
	dialog.classList.toggle( 'is-mobile', !! mobileQuery?.matches );

	if ( config.layout === 'inline' ) {
		placeInline( dialog, config );
	}

	return entry;
}

/**
 * A registered modal by slug.
 *
 * @param {string} slug Modal slug.
 * @return {Object|undefined} Entry.
 */
export function getModal( slug ) {
	return registry.get( slug );
}

/**
 * Every registered modal.
 *
 * @return {Object[]} Entries.
 */
export function allModals() {
	return [ ...registry.values() ];
}

/**
 * Adds a check that automatic triggers must pass before opening.
 * A gate returns true to allow, or a string explaining the refusal.
 *
 * @param {(entry: Object, source: string) => true|string} gate Gate.
 */
export function addGate( gate ) {
	gates.push( gate );
}

/**
 * Subscribes to open/close events.
 *
 * @param {'open'|'close'}                          type     Event.
 * @param {(entry: Object, detail: Object) => void} callback Listener.
 */
export function on( type, callback ) {
	listeners[ type ].push( callback );
}

function emit( type, entry, detail = {} ) {
	listeners[ type ].forEach( ( callback ) => callback( entry, detail ) );
	entry.dialog.dispatchEvent(
		new CustomEvent( `modal-kit:${ type }`, {
			bubbles: true,
			detail: { slug: entry.config.slug, ...detail },
		} )
	);
}

/**
 * Opens a modal.
 *
 * @param {string}  slug              Modal slug.
 * @param {Object}  options           Options.
 * @param {string}  options.source    What opened it: link, or a trigger type.
 * @param {Element} [options.trigger] Element to return focus to.
 * @return {boolean} Whether it opened.
 */
export function openModal( slug, { source, trigger = null } ) {
	const entry = registry.get( slug );

	if ( ! entry ) {
		return false;
	}

	const { dialog, config } = entry;

	if ( dialog.open && ! dialog.classList.contains( 'is-closing' ) ) {
		return false;
	}

	// Links are explicit requests and are never limited; triggers are.
	if ( source !== 'link' ) {
		for ( const gate of gates ) {
			const verdict = gate( entry, source );

			if ( verdict !== true ) {
				log( `"${ slug }" not opened by ${ source }: ${ verdict }` );
				return false;
			}
		}
	}

	// One overlay at a time: close any other modal dialog first.
	if ( config.modal ) {
		registry.forEach( ( other ) => {
			if ( other !== entry && other.dialog.open && other.config.modal ) {
				other.dialog.close();
			}
		} );
	}

	entry.source = source;
	entry.returnFocus =
		trigger ??
		( dialog.ownerDocument.activeElement !== dialog.ownerDocument.body
			? dialog.ownerDocument.activeElement
			: null );

	dialog.classList.remove( 'is-closing' );

	if ( dialog.open ) {
		dialog.close();
	}

	// A layout that leaves the page usable (corner, bar, inline) and opens on
	// its own doesn't take focus from the page: the
	// visitor tabs into it when they want. Links and clicks still move focus.
	entry.quiet = ! config.modal && source !== 'link';

	const before = dialog.ownerDocument.activeElement;

	if ( config.modal ) {
		dialog.showModal();
	} else {
		dialog.show();
	}

	if ( config.lockScroll ) {
		document.documentElement.classList.add( 'modal-kit-locked' );
	}

	if ( ! entry.quiet ) {
		focusInitial( dialog, config );
	} else if ( dialog.contains( dialog.ownerDocument.activeElement ) ) {
		// show() runs the browser's own dialog focusing steps: undo them.
		if ( before && before !== dialog.ownerDocument.body ) {
			before.focus( { preventScroll: true } );
		} else {
			dialog.ownerDocument.activeElement.blur();
		}
	}
	startAutoClose( entry );
	log( `"${ slug }" opened by ${ source }` );
	emit( 'open', entry, { source } );

	return true;
}

/**
 * Closes a modal, playing the exit animation first.
 *
 * @param {HTMLDialogElement} dialog Dialog.
 * @param {string}            reason button | esc | outside | action.
 */
export function closeModal( dialog, reason = 'button' ) {
	if ( ! dialog?.open || dialog.classList.contains( 'is-closing' ) ) {
		return;
	}

	const entry = [ ...registry.values() ].find( ( e ) => e.dialog === dialog );

	if ( entry ) {
		entry.closeReason = reason;
	}

	const animated =
		! dialog.classList.contains( 'modal-kit--anim-none' ) &&
		! window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	if ( ! animated ) {
		dialog.close();
		return;
	}

	dialog.classList.add( 'is-closing' );

	const finish = () => {
		if ( dialog.classList.contains( 'is-closing' ) ) {
			dialog.classList.remove( 'is-closing' );
			dialog.close();
		}
	};

	dialog.addEventListener( 'animationend', finish, { once: true } );
	window.setTimeout( finish, 300 );
}

function onClosed( entry ) {
	const { dialog, config } = entry;

	dialog.classList.remove( 'is-closing' );
	window.clearTimeout( entry.autoTimer );

	const stillLocked = [ ...registry.values() ].some(
		( other ) => other.dialog.open && other.config.lockScroll
	);
	if ( ! stillLocked ) {
		document.documentElement.classList.remove( 'modal-kit-locked' );
	}

	// Drop the #modal-… hash so the link works again and :target stops matching.
	if ( window.location.hash === `#${ dialog.id }` ) {
		window.history.replaceState(
			window.history.state,
			'',
			window.location.pathname + window.location.search
		);
	}

	const target = entry.returnFocus;
	const active = dialog.ownerDocument.activeElement;
	entry.returnFocus = null;

	// A modal that opened without taking focus gives it back only if the
	// visitor went into it (closing drops focus to the body).
	const leaveFocus =
		entry.quiet &&
		active &&
		active !== dialog.ownerDocument.body &&
		! dialog.contains( active );

	if (
		! leaveFocus &&
		target?.isConnected &&
		typeof target.focus === 'function'
	) {
		target.focus( { preventScroll: true } );
	}

	log( `"${ config.slug }" closed (${ entry.closeReason ?? 'closed' })` );
	emit( 'close', entry, { reason: entry.closeReason ?? 'closed' } );
	entry.closeReason = null;
}

/**
 * Auto-close (allowed in Settings → Accessibility, set per modal). Visitors
 * get a pause button (WCAG 2.2.1).
 *
 * @param {Object} entry Registry entry.
 */
function startAutoClose( entry ) {
	window.clearTimeout( entry.autoTimer );
	entry.autoPaused = false;

	if ( entry.config.autoClose > 0 ) {
		entry.autoTimer = window.setTimeout(
			() => closeModal( entry.dialog, 'auto' ),
			entry.config.autoClose * 1000
		);
	}
}

/**
 * Pauses or resumes a modal's auto-close.
 *
 * @param {HTMLDialogElement} dialog Dialog.
 * @return {boolean} Whether it is now paused.
 */
export function toggleAutoClose( dialog ) {
	const entry = [ ...registry.values() ].find( ( e ) => e.dialog === dialog );

	if ( ! entry ) {
		return false;
	}

	if ( entry.autoPaused ) {
		startAutoClose( entry );
		return false;
	}

	window.clearTimeout( entry.autoTimer );
	entry.autoPaused = true;

	return true;
}

/**
 * Moves focus into the modal: the heading by default, or the
 * first field, first button or the close button.
 *
 * @param {HTMLDialogElement} dialog Dialog.
 * @param {Object}            config Context.
 */
function focusInitial( dialog, config ) {
	const panel = dialog.querySelector( '.modal-kit__panel' ) ?? dialog;
	const targets = {
		heading: () =>
			dialog.ownerDocument.getElementById(
				dialog.getAttribute( 'aria-labelledby' ) ?? ''
			) ?? panel.querySelector( HEADING ),
		'first-field': () =>
			panel.querySelector(
				'input:not([type="hidden"]), select, textarea'
			),
		'first-button': () =>
			panel.querySelector(
				'.wp-block-button__link, button:not(.modal-kit__close)'
			),
		close: () => panel.querySelector( '.modal-kit__close' ),
	};

	const target =
		targets[ config.focus ]?.() ??
		targets.heading() ??
		panel.querySelector( FOCUSABLE );

	if ( ! target ) {
		return;
	}

	if (
		! target.matches( FOCUSABLE ) &&
		! target.hasAttribute( 'tabindex' )
	) {
		target.setAttribute( 'tabindex', '-1' );
	}

	target.focus( { preventScroll: true } );
}

/**
 * Inline modals render in the content flow: after the element whose id is
 * the configured anchor, else at the end of the main content.
 *
 * @param {HTMLDialogElement} dialog Dialog.
 * @param {Object}            config Context.
 */
function placeInline( dialog, config ) {
	const anchor = config.inlineAnchor
		? document.getElementById( config.inlineAnchor )
		: null;

	if ( anchor ) {
		anchor.after( dialog );
		return;
	}

	const main =
		document.querySelector( 'main' ) ??
		document.querySelector( '.wp-site-blocks' );

	main?.append( dialog );
}

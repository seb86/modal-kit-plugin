/**
 * Front-end runtime for modals (Interactivity API store `modal-kit`).
 *
 * Each printed <dialog> registers itself on init, starts its automatic
 * triggers, and opens when a link points at it. Opening, closing and focus
 * live in runtime/modals.js; rules that gate automatic triggers plug in
 * through addGate().
 */
import { getContext, getElement, store } from '@wordpress/interactivity';

import {
	addGate,
	allModals,
	closeModal,
	on,
	openModal,
	registerModal,
	setBreakpoint,
	toggleAutoClose,
} from '../../runtime/modals';
import { evaluate } from '../../runtime/rules';
import { browserFor } from '../../runtime/browser';
import { isWebUrl } from '../../runtime/safe-url';
import {
	currentVisit,
	lastAutoOpen,
	markAutoOpen,
	markSeen,
	nextShows,
	seen,
} from '../../runtime/visitor';
import { bindLinks, openFromArrival } from '../../runtime/links';
import { startTriggers } from '../../runtime/triggers';
import { whenReady } from '../../runtime/wait';
import { setDebug } from '../../runtime/log';
import { copyText } from '../../runtime/copy';

// The runtime is here: the no-JS :target fallback in style.scss stands down.
document.documentElement.classList.add( 'modal-kit-js' );

const visit = currentVisit();
const browser = browserFor( window.navigator.userAgent );
let pageAutoOpens = 0;

// State comes from the server (Render::state()); client-side defaults would
// override it, so fallbacks are applied where values are read.
const { state } = store( 'modal-kit', {
	actions: {
		close() {
			closeModal( getElement().ref.closest( 'dialog' ), 'button' );
		},
		// Button actions (ButtonActions.php): close, copy.
		buttonAction( event ) {
			const button = getElement().ref;
			const action = button.dataset.modalKitAction;

			if ( action === 'close' ) {
				event.preventDefault();
				closeModal( button.closest( 'dialog' ), 'action' );
			}

			if ( action === 'copy' ) {
				event.preventDefault();
				copyText(
					button,
					button.dataset.modalKitCopy || button.textContent.trim(),
					state.i18n ?? {}
				);
				return;
			}

			// Actions registered by add-ons (e.g. steps in Modal Kit Pro).
			if ( action !== 'close' ) {
				event.preventDefault();
				button.dispatchEvent(
					new window.CustomEvent( 'modal-kit:action', {
						bubbles: true,
						detail: { action, button },
					} )
				);
			}
		},
		toggleAutoClose() {
			const button = getElement().ref;
			const paused = toggleAutoClose( button.closest( 'dialog' ) );
			const i18n = state.i18n ?? {};

			button.setAttribute( 'aria-pressed', paused ? 'true' : 'false' );
			button.textContent = paused
				? ( i18n.resume ?? 'Resume' )
				: ( i18n.pause ?? 'Pause' );
		},
		// "Play video" on a click-to-load screen.
		loadVideo( event ) {
			event.preventDefault();
			const button = getElement().ref;
			loadVideoModule().then( ( video ) =>
				video.loadFromConsent( button )
			);
		},
		// "Play in video lightbox" links. The link stays a real URL.
		playVideo( event ) {
			const link = getElement().ref;
			const lightbox = document.getElementById(
				`${ state.prefix ?? 'modal-' }video-lightbox`
			);

			if (
				! lightbox ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey
			) {
				return;
			}

			event.preventDefault();
			loadVideoModule().then( ( video ) => {
				if (
					video.fillLightbox(
						lightbox,
						link.dataset.modalKitVideo,
						link.dataset.modalKitClickToLoad !== '0',
						state.i18n ?? {}
					)
				) {
					openModal( 'video-lightbox', {
						source: 'link',
						trigger: link,
					} );
				} else if ( isWebUrl( link.dataset.modalKitVideo ) ) {
					window.location.href = link.dataset.modalKitVideo;
				}
			} );
		},
		// Enter and Space on a Cover that plays a video.
		videoKey( event ) {
			if ( event.key === 'Enter' || event.key === ' ' ) {
				event.preventDefault();
				getElement().ref.click();
			}
		},
		// Enter and Space on link-styled buttons without an address.
		buttonKey( event ) {
			if ( event.key === 'Enter' || event.key === ' ' ) {
				event.preventDefault();
				getElement().ref.click();
			}
		},
		onCancel( event ) {
			// Esc. Handle it ourselves so the exit animation plays.
			event.preventDefault();

			if ( getContext().esc ) {
				closeModal( getElement().ref, 'esc' );
			}
		},
		onClick( event ) {
			const dialog = getElement().ref;

			// The dialog fills the viewport; a click on it, not on the panel,
			// is a click outside.
			if ( event.target === dialog && getContext().outside ) {
				closeModal( dialog, 'outside' );
			}
		},
	},
	callbacks: {
		init() {
			const context = getContext();
			const dialog = getElement().ref;
			const config = JSON.parse( JSON.stringify( context ) );

			setDebug( state.debug );
			setBreakpoint( state.breakpoint ?? 600 );
			const formats = {
				hash: state.linkHash !== false,
				query: state.linkQuery !== false,
			};

			bindLinks( state.prefix ?? 'modal-', formats );
			registerModal( dialog, config );

			// Any link or button in the modal, other than closing it, is the
			// call to action ("stop after the visitor clicks a button").
			dialog.addEventListener( 'click', ( event ) => {
				const target = event.target.closest?.(
					'a[href], button, .wp-block-button__link'
				);

				if (
					target &&
					! target.closest( '.modal-kit__close' ) &&
					target.dataset.modalKitAction !== 'close' &&
					state.remember !== false
				) {
					markSeen( config.slug, { cta: true } );
				}
			} );

			// Add-ons open modals for their own triggers (e.g. "Added to
			// cart"); rules apply unless the source is a link.
			dialog.addEventListener( 'modal-kit:request-open', ( event ) => {
				openModal( config.slug, {
					source: event.detail?.source ?? 'add-on',
					trigger: event.detail?.trigger ?? null,
				} );
			} );

			// Add-ons ask for "never again" (e.g. after a form is sent).
			dialog.addEventListener( 'modal-kit:suppress', () => {
				if ( state.remember !== false ) {
					markSeen( config.slug, { never: true } );
				}
			} );

			openFromArrival( config.slug, state.prefix ?? 'modal-', formats );

			// Add-ons may hold the triggers back to set the modal up first
			// (data-modal-kit-wait), then adjust them on modal-kit:configure
			// (Pro: an A/B variant's own trigger and delay).
			whenReady( dialog, () => {
				dialog.dispatchEvent(
					new window.CustomEvent( 'modal-kit:configure', {
						detail: { slug: config.slug, config },
					} )
				);

				// An inline modal without triggers shows as soon as the page
				// loads.
				const triggers =
					config.layout === 'inline' && ! config.triggers?.length
						? [ { type: 'load', delay: 0 } ]
						: config.triggers;

				startTriggers( triggers, ( type ) =>
					openModal( config.slug, { source: type } )
				);
			} );

			// Add-ons that open a modal themselves (Pro: the age gate) wait
			// for this: from now on it answers modal-kit:request-open.
			dialog.setAttribute( 'data-modal-kit-ready', '' );
			dialog.dispatchEvent(
				new window.CustomEvent( 'modal-kit:ready', {
					bubbles: true,
					detail: { slug: config.slug },
				} )
			);
		},
	},
} );

// Add-ons hold a modal back with data-modal-kit-hold="reason", on the dialog
// (e.g. Pro's "only when the cart is empty") or on a marker inside it, so
// several add-ons can hold the same modal without clearing each other.
addGate( ( entry ) => {
	const hold = entry.dialog.hasAttribute( 'data-modal-kit-hold' )
		? entry.dialog
		: entry.dialog.querySelector( '[data-modal-kit-hold]' );

	return hold
		? hold.getAttribute( 'data-modal-kit-hold' ) || 'held by an add-on'
		: true;
} );

// Rules (frequency, schedule, devices, page views, site limits). An admin
// preview (?modal=preview) bypasses them.
addGate( ( entry ) =>
	state.preview
		? true
		: evaluate( {
				rules: entry.config.rules ?? {},
				version: entry.config.version,
				targeted: entry.config.targeted !== false,
				hidden: !! entry.config.hidden,
				seen: seen( entry.config.slug ),
				visit,
				site: {
					autoOpenLimit: state.autoOpenLimit ?? 1,
					cooldown: state.cooldown ?? 20,
					remember: state.remember !== false,
					breakpoint: state.breakpoint ?? 600,
				},
				pageAutoOpens,
				lastAutoOpen: lastAutoOpen(),
				now: Date.now(),
				viewportWidth: window.innerWidth,
				browser,
			} )
);

on( 'open', ( entry, { source } ) => {
	if ( source !== 'link' ) {
		pageAutoOpens++;
		markAutoOpen();
	}

	if ( state.remember !== false ) {
		markSeen( entry.config.slug, {
			at: Date.now(),
			version: entry.config.version,
			visit: visit.id,
			shows: nextShows(
				seen( entry.config.slug ),
				entry.config.version,
				source !== 'link'
			),
		} );
	}
} );

// "Wait N days" counts from when the visitor closed it.
on( 'close', ( entry ) => {
	if ( state.remember !== false ) {
		markSeen( entry.config.slug, { at: Date.now() } );
	}
} );

// Video: loaded only for modals that have it.
let videoModule = null;
function loadVideoModule() {
	videoModule ??= import(
		/* webpackChunkName: "video" */ '../../runtime/video'
	);
	return videoModule;
}

on( 'open', ( entry ) => {
	if ( entry.config.video ) {
		loadVideoModule().then( ( video ) => video.onOpen( entry ) );
	}
} );

on( 'close', ( entry ) => {
	if ( entry.config.video ) {
		loadVideoModule().then( ( video ) => video.onClose( entry ) );
	}
} );

// Automatic triggers never interrupt a modal that is already open.
addGate( ( entry ) =>
	allModals().some(
		( other ) => other !== entry && other.dialog.open && other.config.modal
	)
		? 'another modal is open'
		: true
);

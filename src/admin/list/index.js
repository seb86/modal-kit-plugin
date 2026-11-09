/**
 * Modal list: On / off switches saved through REST, and the
 * Copy link row action.
 */
import apiFetch from '@wordpress/api-fetch';
import { speak } from '@wordpress/a11y';
import domReady from '@wordpress/dom-ready';
import { __ } from '@wordpress/i18n';

import './style.scss';

async function toggle( button ) {
	const enabled = button.getAttribute( 'aria-checked' ) !== 'true';

	button.disabled = true;
	button.setAttribute( 'aria-checked', String( enabled ) );

	try {
		await apiFetch( {
			path: `/wp/v2/mk_modal/${ button.dataset.id }`,
			method: 'POST',
			data: { meta: { _modal_kit_enabled: enabled } },
		} );
		speak(
			enabled
				? __( 'Modal turned on.', 'modal-kit' )
				: __( 'Modal turned off.', 'modal-kit' )
		);
	} catch {
		button.setAttribute( 'aria-checked', String( ! enabled ) );
		speak( __( 'Couldn’t save. Try again.', 'modal-kit' ), 'assertive' );
	} finally {
		button.disabled = false;
	}
}

async function copy( button ) {
	const text = button.dataset.copy;

	try {
		await window.navigator.clipboard.writeText( text );
	} catch {
		const field = document.createElement( 'textarea' );
		field.value = text;
		document.body.append( field );
		field.select();
		document.execCommand( 'copy' );
		field.remove();
	}

	const label = button.firstChild;
	const original = label.textContent;
	label.textContent = __( 'Copied', 'modal-kit' ) + ' ';
	speak( __( 'Link copied.', 'modal-kit' ) );
	window.setTimeout( () => ( label.textContent = original ), 2000 );
}

/**
 * Remembers that the user dismissed a Pro notice, for good.
 *
 * @param {string} key Listing key.
 */
function dismissForGood( key ) {
	apiFetch( { path: '/wp/v2/users/me?context=edit' } )
		.then( ( user ) =>
			apiFetch( {
				path: '/wp/v2/users/me',
				method: 'POST',
				data: {
					meta: {
						modal_kit_dismissed: {
							...( user.meta?.modal_kit_dismissed ?? {} ),
							[ key ]: 4102444800, // 2100-01-01: permanent.
						},
					},
				},
			} )
		)
		.catch( () => {} );
}

domReady( () => {
	document.addEventListener( 'click', ( event ) => {
		const dismiss = event.target.closest?.(
			'.modal-kit-milestone .notice-dismiss'
		);

		if ( dismiss ) {
			dismissForGood(
				dismiss.closest( '.modal-kit-milestone' ).dataset.key
			);
			return;
		}

		const target = event.target.closest?.(
			'.modal-kit-switch, .modal-kit-copy-link'
		);

		if ( ! target ) {
			return;
		}

		event.preventDefault();

		if ( target.classList.contains( 'modal-kit-switch' ) ) {
			toggle( target );
		} else {
			copy( target );
		}
	} );
} );

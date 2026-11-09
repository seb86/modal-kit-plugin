/**
 * Upgrade prompts in the modal editor: the WooCommerce trigger
 * group (only on sites with a store) and the collapsed Forms panel. Both are
 * plain listings; Modal Kit Pro removes them by filtering the listings.
 */
import { __ } from '@wordpress/i18n';
import { Button, ExternalLink, MenuGroup } from '@wordpress/components';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { useState } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';

import { dismiss, listings } from './dismiss';

function ProBadge() {
	return (
		<span className="modal-kit-pro-badge">
			{ __( 'PRO', 'modal-kit' ) }
		</span>
	);
}

/**
 * The WooCommerce trigger group in the Add trigger menu.
 *
 * @param {Object} listing Listing from the server.
 * @return {() => Element} Menu group component.
 */
function wooTriggerGroup( listing ) {
	return function WooTriggers( { onClose } ) {
		const [ hidden, setHidden ] = useState( false );

		// The menu remounts this group when it reopens: ask again each time.
		if (
			hidden ||
			! listings( 'trigger' ).some( ( { key } ) => key === listing.key )
		) {
			return null;
		}

		return (
			<MenuGroup
				label={
					<>
						{ listing.title } <ProBadge />
					</>
				}
				className="modal-kit-pro-menu-group"
			>
				<ul className="modal-kit-pro-menu-group__items">
					{ listing.items.map( ( item ) => (
						<li key={ item }>{ item }</li>
					) ) }
				</ul>
				<div className="modal-kit-pro-menu-group__note">
					<p>{ listing.description }</p>
					<p>
						<ExternalLink href={ listing.url }>
							{ __(
								'Learn about Pro for WooCommerce',
								'modal-kit'
							) }
						</ExternalLink>
						{ ' · ' }
						<Button
							variant="link"
							onClick={ () => {
								setHidden( true );
								dismiss( listing.key );
								onClose?.();
							} }
						>
							{ __( 'Not now', 'modal-kit' ) }
						</Button>
					</p>
				</div>
			</MenuGroup>
		);
	};
}

addFilter(
	'modalKit.triggerMenuGroups',
	'modal-kit/upsell/woo-triggers',
	( groups ) => [ ...groups, ...listings( 'trigger' ).map( wooTriggerGroup ) ]
);

function FormsPanel() {
	const [ hidden, setHidden ] = useState( false );
	const [ listing ] = listings( 'panel' );

	if ( ! listing || hidden ) {
		return null;
	}

	return (
		<PluginDocumentSettingPanel
			name="modal-kit-forms-upsell"
			title={
				<>
					{ listing.title } <ProBadge />
				</>
			}
			className="modal-kit-panel"
		>
			<p className="modal-kit-panel__intro">{ listing.description }</p>
			<p>
				<ExternalLink href={ listing.url }>
					{ __( 'See Pro', 'modal-kit' ) }
				</ExternalLink>
				{ ' · ' }
				<Button
					variant="link"
					onClick={ () => {
						setHidden( true );
						dismiss( listing.key, true );
					} }
				>
					{ __( 'Hide this panel', 'modal-kit' ) }
				</Button>
			</p>
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'modal-kit-forms-upsell', { render: FormsPanel } );

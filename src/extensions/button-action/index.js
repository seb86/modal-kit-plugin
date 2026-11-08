/**
 * "Action" control for core/button inside modals (mockups 2b, 4a).
 *
 * The action is stored as block attributes only, so the button's saved
 * markup doesn't change. ButtonActions.php adds the runtime directives when
 * the button renders. Modal Kit Pro adds actions through the
 * `modalKit.buttonActions` filter; until then they appear as Pro listings.
 */
import { __ } from '@wordpress/i18n';
import { addFilter, applyFilters } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls } from '@wordpress/block-editor';
import {
	Button,
	ExternalLink,
	PanelBody,
	Popover,
	RadioControl,
	TextControl,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { useState } from '@wordpress/element';

import { dismiss } from '../../editor/upsell/dismiss';
import './style.scss';

const POST_TYPE = 'mk_modal';

/**
 * The actions available, after add-ons have had their say.
 *
 * @return {Object[]} { value, label, Settings? }.
 */
export function getActions() {
	return applyFilters( 'modalKit.buttonActions', [
		{ value: 'link', label: __( 'Open link', 'modal-kit' ) },
		{ value: 'close', label: __( 'Close modal', 'modal-kit' ) },
		{
			value: 'copy',
			label: __( 'Copy text', 'modal-kit' ),
			Settings: CopySettings,
		},
	] );
}

function CopySettings( { attributes, setAttributes } ) {
	return (
		<TextControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			label={ __( 'Text to copy', 'modal-kit' ) }
			help={ __(
				'For example a discount code. Visitors see “Copied” after clicking.',
				'modal-kit'
			) }
			value={ attributes.modalKitCopyText ?? '' }
			onChange={ ( modalKitCopyText ) =>
				setAttributes( { modalKitCopyText } )
			}
		/>
	);
}

function ProListing( { listing } ) {
	const [ isOpen, setIsOpen ] = useState( false );
	const [ hidden, setHidden ] = useState( false );

	if ( hidden ) {
		return null;
	}

	return (
		<div className="modal-kit-pro-listing">
			<Button
				className="modal-kit-pro-listing__toggle"
				onClick={ () => setIsOpen( ( open ) => ! open ) }
				aria-expanded={ isOpen }
				__next40pxDefaultSize
			>
				<span aria-hidden="true">+</span>
				<span>{ listing.label }</span>
				<span className="modal-kit-pro-badge">
					{ __( 'PRO', 'modal-kit' ) }
				</span>
			</Button>
			{ isOpen && (
				<Popover
					placement="left-start"
					onClose={ () => setIsOpen( false ) }
					className="modal-kit-pro-popover"
				>
					<div className="modal-kit-pro-popover__body">
						<h3>{ listing.title }</h3>
						<p>{ listing.description }</p>
						<div className="modal-kit-pro-popover__actions">
							<ExternalLink href={ listing.url }>
								{ __( 'See what’s in Pro', 'modal-kit' ) }
							</ExternalLink>
							<Button
								variant="tertiary"
								onClick={ () => {
									setIsOpen( false );
									setHidden( true );
									dismiss( listing.key );
								} }
							>
								{ __( 'Not now', 'modal-kit' ) }
							</Button>
						</div>
					</div>
				</Popover>
			) }
		</div>
	);
}

function ActionPanel( { attributes, setAttributes, clientId } ) {
	const actions = getActions();
	const current = attributes.modalKitAction || 'link';
	const active = actions.find( ( action ) => action.value === current );
	const listings = ( window.modalKitEditor?.proListings ?? [] ).filter(
		( listing ) =>
			listing.area === 'button-action' &&
			! actions.some( ( action ) => action.value === listing.key )
	);

	return (
		<InspectorControls>
			<PanelBody
				title={ __( 'Action', 'modal-kit' ) }
				className="modal-kit-action-panel"
			>
				<RadioControl
					label={ __( 'When clicked', 'modal-kit' ) }
					hideLabelFromVision
					selected={ current }
					options={ actions.map( ( { value, label } ) => ( {
						value,
						label,
					} ) ) }
					onChange={ ( value ) =>
						setAttributes( {
							modalKitAction:
								value === 'link' ? undefined : value,
						} )
					}
				/>
				{ active?.Settings && (
					<active.Settings
						attributes={ attributes }
						setAttributes={ setAttributes }
						clientId={ clientId }
					/>
				) }
				{ listings.length > 0 && (
					<div className="modal-kit-pro-listings">
						<p className="modal-kit-pro-listings__heading">
							{ __( 'More with Pro', 'modal-kit' ) }
						</p>
						{ listings.map( ( listing ) => (
							<ProListing
								key={ listing.key }
								listing={ listing }
							/>
						) ) }
					</div>
				) }
			</PanelBody>
		</InspectorControls>
	);
}

addFilter(
	'blocks.registerBlockType',
	'modal-kit/button-action/attributes',
	( settings, name ) => {
		if ( name !== 'core/button' ) {
			return settings;
		}

		return {
			...settings,
			attributes: {
				...settings.attributes,
				modalKitAction: { type: 'string' },
				modalKitCopyText: { type: 'string' },
			},
		};
	}
);

addFilter(
	'editor.BlockEdit',
	'modal-kit/button-action/control',
	createHigherOrderComponent(
		( BlockEdit ) =>
			function ButtonActionEdit( props ) {
				const isModal = useSelect(
					( select ) =>
						select( editorStore ).getCurrentPostType() ===
						POST_TYPE,
					[]
				);

				if ( props.name !== 'core/button' || ! isModal ) {
					return <BlockEdit { ...props } />;
				}

				return (
					<>
						<BlockEdit { ...props } />
						<ActionPanel
							attributes={ props.attributes }
							setAttributes={ props.setAttributes }
							clientId={ props.clientId }
						/>
					</>
				);
			},
		'withModalKitButtonAction'
	)
);

/**
 * Triggers panel: link clicks are always on; automatic triggers
 * are added from a menu, each with its own settings.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import { useCopyToClipboard } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import {
	store as editorStore,
	PluginDocumentSettingPanel,
} from '@wordpress/editor';
import { useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { moreVertical, plus } from '@wordpress/icons';

import useModalMeta from './use-modal-meta';
import { allLayouts } from '../../blocks/modal/layouts';

/**
 * Trigger types: label, description and default settings. Add-ons add theirs
 * with the `modalKit.triggerTypes` filter; each may bring `Settings` (a
 * component receiving { trigger, set }) and a `group` (its own menu
 * section, e.g. "Shop").
 *
 * @return {Object} Types by name.
 */
export function triggerTypes() {
	return applyFilters( 'modalKit.triggerTypes', {
		load: {
			label: __( 'Page load + delay', 'modal-kit' ),
			description: __( 'Open after N seconds on the page', 'modal-kit' ),
			defaults: { delay: 5 },
		},
		scroll: {
			label: __( 'Scroll depth', 'modal-kit' ),
			description: __(
				'Open once the visitor scrolls this far',
				'modal-kit'
			),
			defaults: { percent: 50 },
		},
		exit: {
			label: __( 'Leaving the page', 'modal-kit' ),
			description: __(
				'The pointer leaves the window (desktop)',
				'modal-kit'
			),
			defaults: { touch: 'scroll-up' },
		},
		time: {
			label: __( 'Time on site', 'modal-kit' ),
			description: __(
				'Total time across pages this visit',
				'modal-kit'
			),
			defaults: { delay: 30 },
		},
		inactivity: {
			label: __( 'Inactivity', 'modal-kit' ),
			description: __(
				'No scroll, click or keypress for N seconds',
				'modal-kit'
			),
			defaults: { delay: 30 },
		},
		url: {
			label: __( 'URL hash or query', 'modal-kit' ),
			description: __(
				'Arrive with a query like utm_campaign=autumn, or a #hash',
				'modal-kit'
			),
			defaults: { value: '' },
		},
		element: {
			label: __( 'Element in view', 'modal-kit' ),
			description: __(
				'When a block with an anchor scrolls into view',
				'modal-kit'
			),
			defaults: { anchor: '' },
		},
	} );
}

function NumberField( { label, value, onChange, min = 0, max, help } ) {
	return (
		<TextControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			type="number"
			min={ min }
			max={ max }
			label={ label }
			help={ help }
			value={ value ?? '' }
			onChange={ ( next ) =>
				onChange( Math.max( min, parseInt( next, 10 ) || 0 ) )
			}
		/>
	);
}

function TriggerSettings( { trigger, onChange, type } ) {
	const set = ( changes ) => onChange( { ...trigger, ...changes } );

	if ( type?.Settings ) {
		return <type.Settings trigger={ trigger } set={ set } />;
	}

	switch ( trigger.type ) {
		case 'load':
		case 'time':
		case 'inactivity':
			return (
				<NumberField
					label={ __( 'Seconds', 'modal-kit' ) }
					value={ trigger.delay }
					max={ 3600 }
					onChange={ ( delay ) => set( { delay } ) }
				/>
			);
		case 'scroll':
			return (
				<NumberField
					label={ __( 'Percent of the page', 'modal-kit' ) }
					value={ trigger.percent }
					min={ 1 }
					max={ 100 }
					onChange={ ( percent ) =>
						set( { percent: Math.min( 100, percent ) } )
					}
				/>
			);
		case 'exit':
			return (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'On touch devices', 'modal-kit' ) }
					value={ trigger.touch ?? 'scroll-up' }
					options={ [
						{
							value: 'scroll-up',
							label: __( 'Fast scroll up', 'modal-kit' ),
						},
						{
							value: 'none',
							label: __( 'Don’t open', 'modal-kit' ),
						},
					] }
					onChange={ ( touch ) => set( { touch } ) }
				/>
			);
		case 'url':
			return (
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Query or hash', 'modal-kit' ) }
					placeholder="utm_campaign=autumn"
					value={ trigger.value ?? '' }
					onChange={ ( value ) => set( { value } ) }
				/>
			);
		case 'element':
			return (
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Block anchor', 'modal-kit' ) }
					help={ __(
						'Set it in the block’s Advanced panel (HTML anchor).',
						'modal-kit'
					) }
					placeholder="workshops"
					value={ trigger.anchor ?? '' }
					onChange={ ( anchor ) =>
						set( { anchor: anchor.replace( /^#/, '' ) } )
					}
				/>
			);
		default:
			return null;
	}
}

function LinkTrigger() {
	const { slug, isSaved } = useSelect( ( select ) => {
		const editor = select( editorStore );

		return {
			slug:
				editor.getEditedPostAttribute( 'slug' ) ||
				editor.getCurrentPost()?.generated_slug,
			isSaved: ! editor.isEditedPostNew(),
		};
	}, [] );
	const [ copied, setCopied ] = useState( false );
	const anchor = `#${ window.modalKitEditor?.prefix ?? 'modal-' }${ slug }`;
	const copyRef = useCopyToClipboard( anchor, () => {
		setCopied( true );
		window.setTimeout( () => setCopied( false ), 2000 );
	} );

	return (
		<div className="modal-kit-trigger is-always-on">
			<div className="modal-kit-trigger__header">
				<strong>{ __( 'Link or button click', 'modal-kit' ) }</strong>
				<span className="modal-kit-trigger__badge">
					{ __( 'Always on', 'modal-kit' ) }
				</span>
			</div>
			{ isSaved && slug ? (
				<>
					<p className="modal-kit-trigger__help">
						{ __( 'Link any block to this address:', 'modal-kit' ) }
					</p>
					<div className="modal-kit-trigger__anchor">
						<code>{ anchor }</code>
						<Button
							variant="secondary"
							size="compact"
							ref={ copyRef }
						>
							{ copied
								? __( 'Copied', 'modal-kit' )
								: __( 'Copy', 'modal-kit' ) }
						</Button>
					</div>
				</>
			) : (
				<p className="modal-kit-trigger__help">
					{ __(
						'Save the modal to get its link address.',
						'modal-kit'
					) }
				</p>
			) }
		</div>
	);
}

export default function TriggersPanel() {
	const [ triggers, setTriggers ] = useModalMeta( 'triggers' );
	const types = triggerTypes();
	const used = triggers.map( ( trigger ) => trigger.type );

	const update = ( index, next ) =>
		setTriggers(
			triggers.map( ( trigger, i ) => ( i === index ? next : trigger ) )
		);
	const remove = ( index ) =>
		setTriggers( triggers.filter( ( trigger, i ) => i !== index ) );
	const add = ( type ) =>
		setTriggers( [ ...triggers, { type, ...types[ type ].defaults } ] );

	/**
	 * Extra trigger groups (Pro listings for WooCommerce triggers).
	 */
	const extraGroups = applyFilters( 'modalKit.triggerMenuGroups', [] );

	// Add-on layouts that open themselves (Pro: the age gate) say so here
	// instead of offering triggers.
	const layoutNote = useSelect( ( select ) => {
		const modal = select( blockEditorStore )
			.getBlocks()
			.find( ( block ) => block.name === 'modal-kit/modal' );

		return allLayouts()[ modal?.attributes.modalLayout ]?.triggerNote;
	}, [] );

	if ( layoutNote ) {
		return (
			<PluginDocumentSettingPanel
				name="modal-kit-triggers"
				title={ __( 'Triggers', 'modal-kit' ) }
				className="modal-kit-panel"
			>
				<p className="modal-kit-panel__intro">{ layoutNote }</p>
				<LinkTrigger />
			</PluginDocumentSettingPanel>
		);
	}

	return (
		<PluginDocumentSettingPanel
			name="modal-kit-triggers"
			title={
				triggers.length
					? sprintf(
							/* translators: %d: number of automatic triggers. */
							__( 'Triggers (%d)', 'modal-kit' ),
							triggers.length
						)
					: __( 'Triggers', 'modal-kit' )
			}
			className="modal-kit-panel"
		>
			<p className="modal-kit-panel__intro">
				{ __(
					'The modal opens when any one of these happens.',
					'modal-kit'
				) }
			</p>
			<LinkTrigger />
			{ triggers.map( ( trigger, index ) =>
				types[ trigger.type ] ? (
					<div
						className="modal-kit-trigger"
						key={ trigger.type + index }
					>
						<div className="modal-kit-trigger__header">
							<strong>{ types[ trigger.type ].label }</strong>
							<DropdownMenu
								icon={ moreVertical }
								label={ sprintf(
									/* translators: %s: trigger name. */
									__( '%s options', 'modal-kit' ),
									types[ trigger.type ].label
								) }
								controls={ [
									{
										title: __( 'Remove', 'modal-kit' ),
										onClick: () => remove( index ),
									},
								] }
							/>
						</div>
						<TriggerSettings
							trigger={ trigger }
							type={ types[ trigger.type ] }
							onChange={ ( next ) => update( index, next ) }
						/>
					</div>
				) : null
			) }
			<DropdownMenu
				icon={ plus }
				label={ __( 'Add trigger', 'modal-kit' ) }
				text={ __( 'Add trigger', 'modal-kit' ) }
				toggleProps={ {
					variant: 'secondary',
					__next40pxDefaultSize: true,
				} }
				popoverProps={ { placement: 'left-start' } }
			>
				{ ( { onClose } ) => (
					<>
						<MenuGroup label={ __( 'Add trigger', 'modal-kit' ) }>
							{ Object.entries( types )
								.filter( ( [ , def ] ) => ! def.group )
								.map( ( [ type, def ] ) => (
									<MenuItem
										key={ type }
										info={
											used.includes( type )
												? __(
														'Already added',
														'modal-kit'
													)
												: def.description
										}
										disabled={ used.includes( type ) }
										onClick={ () => {
											add( type );
											onClose();
										} }
									>
										{ def.label }
									</MenuItem>
								) ) }
						</MenuGroup>
						{ [
							...new Set(
								Object.values( types )
									.map( ( def ) => def.group )
									.filter( Boolean )
							),
						].map( ( group ) => (
							<MenuGroup key={ group } label={ group }>
								{ Object.entries( types )
									.filter(
										( [ , def ] ) => def.group === group
									)
									.map( ( [ type, def ] ) => (
										<MenuItem
											key={ type }
											info={
												used.includes( type )
													? __(
															'Already added',
															'modal-kit'
														)
													: def.description
											}
											disabled={ used.includes( type ) }
											onClick={ () => {
												add( type );
												onClose();
											} }
										>
											{ def.label }
										</MenuItem>
									) ) }
							</MenuGroup>
						) ) }
						{ extraGroups.map( ( Group, index ) => (
							<Group key={ index } onClose={ onClose } />
						) ) }
					</>
				) }
			</DropdownMenu>
		</PluginDocumentSettingPanel>
	);
}

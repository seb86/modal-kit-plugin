/**
 * Pattern picker shown when a new modal is created, and again
 * from the Modal block's "Change template".
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	BlockPreview,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	Button,
	CheckboxControl,
	ExternalLink,
	Modal,
	SearchControl,
} from '@wordpress/components';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { cloneBlock } from '@wordpress/blocks';
import { applyFilters } from '@wordpress/hooks';

import useStarterPatterns, {
	POST_TYPE,
	THEME_CATEGORY,
	USER_CATEGORY,
} from './use-starter-patterns';
import { LAYOUT_NAMES, allLayouts, resolve } from '../../blocks/modal/layouts';
import Glyph from '../../blocks/modal/glyphs';
import { dismiss, listings } from '../upsell/dismiss';
import { fixedStyles, resolveStyle } from '../../styles';
import { OPEN_PICKER_EVENT } from './open';
import './style.scss';

const MODAL_BLOCK = 'modal-kit/modal';

const LAYOUT_FILTER_LABELS = {
	centered: __( 'Centered', 'modal-kit' ),
	split: __( 'Split', 'modal-kit' ),
	corner: __( 'Corner', 'modal-kit' ),
	bar: __( 'Bar', 'modal-kit' ),
	drawer: __( 'Drawer', 'modal-kit' ),
	full: __( 'Full-screen', 'modal-kit' ),
	sheet: __( 'Sheet', 'modal-kit' ),
	inline: __( 'Inline', 'modal-kit' ),
	// Named on cards and in the preview; not a filter (Video is a category).
	video: __( 'Video', 'modal-kit' ),
};

const FILTER_ORDER = [
	'centered',
	'split',
	'corner',
	'bar',
	'drawer',
	'full',
	'sheet',
	'inline',
].filter( ( name ) => LAYOUT_NAMES.includes( name ) );

/**
 * The modal settings a starter brings (triggers, rules, overrides; PHP
 * `modal_kit_starter_settings`), as a meta edit. Rules and overrides are
 * merged into what the modal already has.
 *
 * @param {Object} starter Starter.
 * @param {Object} meta    The modal's current meta.
 * @return {Object|null} Meta changes, or null.
 */
export function starterMeta( starter, meta = {} ) {
	const settings = window.modalKitEditor?.starterSettings?.[ starter.name ];

	if ( ! settings ) {
		return null;
	}

	const changes = {};

	if ( settings.triggers ) {
		changes._modal_kit_triggers = settings.triggers;
	}

	if ( settings.rules ) {
		const current =
			meta._modal_kit_rules ?? window.modalKitEditor?.ruleDefaults ?? {};
		changes._modal_kit_rules = { ...current };

		Object.entries( settings.rules ).forEach( ( [ key, value ] ) => {
			changes._modal_kit_rules[ key ] =
				value && typeof value === 'object' && ! Array.isArray( value )
					? { ...( current[ key ] ?? {} ), ...value }
					: value;
		} );
	}

	if ( settings.overrides ) {
		const current = Array.isArray( meta._modal_kit_overrides )
			? {}
			: ( meta._modal_kit_overrides ?? {} );
		changes._modal_kit_overrides = { ...current, ...settings.overrides };
	}

	return { ...meta, ...changes };
}

const STYLE_CLASS = /(?:^|\s)is-style-[a-z0-9_-]+/;

/**
 * A starter keeps the modal's style: on a new modal that's the default from
 * Settings → Display (the post type template), on "Change template" the
 * style the modal already has. A starter with a style of its own (Parting
 * gift: Editorial) keeps that instead.
 *
 * @param {Object} incoming Attributes of the starter's Modal block.
 * @param {Object} current  Attributes of the Modal block in the editor.
 * @return {Object} Attributes to use.
 */
export function keepStyle( incoming = {}, current = {} ) {
	if ( STYLE_CLASS.test( incoming.className ?? '' ) ) {
		return incoming;
	}

	const style = ( current.className ?? '' ).match( STYLE_CLASS )?.[ 0 ];

	if ( ! style ) {
		return incoming;
	}

	return {
		...incoming,
		className: [ incoming.className, style.trim() ]
			.filter( Boolean )
			.join( ' ' ),
		...( current.styleOptions && {
			styleOptions: current.styleOptions,
		} ),
	};
}

/**
 * A starter as it will look in this modal: its Modal block with the style
 * keepStyle() gives it, so the cards and the preview match what "Use
 * template" inserts.
 *
 * @param {Object} starter Starter.
 * @param {Object} current Attributes of the Modal block in the editor.
 * @return {Object} Starter.
 */
export function withStyle( starter, current ) {
	return {
		...starter,
		blocks: starter.blocks.map( ( block ) =>
			block.name === MODAL_BLOCK
				? {
						...block,
						attributes: keepStyle( block.attributes, current ),
					}
				: block
		),
	};
}

/**
 * The style line of the preview pane.
 *
 * @param {Object} starter Starter (with its style applied).
 * @return {string} "Uses the Fieldnote style", or the theme line.
 */
function styleLine( starter ) {
	const modal = starter.blocks.find(
		( block ) => block.name === MODAL_BLOCK
	);
	const { slug } = resolveStyle( modal?.attributes );

	return slug
		? sprintf(
				/* translators: %s: style name, e.g. Fieldnote. */
				__( 'Uses the %s style', 'modal-kit' ),
				fixedStyles()[ slug ].label
			)
		: __( 'Uses your theme’s styles', 'modal-kit' );
}

/**
 * A–Z in the site's language (cards, categories and collections).
 *
 * @param {string} a First name.
 * @param {string} b Second name.
 * @return {number} Sort order.
 */
function byName( a, b ) {
	return String( a ).localeCompare(
		String( b ),
		document.documentElement.lang || undefined,
		{ sensitivity: 'base' }
	);
}

/**
 * A layout's name on cards, filters and the preview; add-on layouts (Pro:
 * the age gate) bring their own.
 *
 * @param {string} name Layout.
 * @return {string} Label.
 */
function layoutName( name ) {
	return LAYOUT_FILTER_LABELS[ name ] ?? allLayouts()[ name ]?.label ?? name;
}

const FEATURE_LABELS = {
	'multi-step': __( 'Multi-step', 'modal-kit' ),
	form: __( 'Form', 'modal-kit' ),
	countdown: __( 'Countdown', 'modal-kit' ),
	video: __( 'Video', 'modal-kit' ),
};

const MOBILE_LABELS = {
	...LAYOUT_FILTER_LABELS,
	'bar-top': __( 'Bar', 'modal-kit' ),
	'bar-bottom': __( 'Bar', 'modal-kit' ),
};

/**
 * "3 steps · Form · Centered → Sheet" for the preview pane.
 *
 * @param {Object} starter Starter.
 * @return {string[]} Parts.
 */
function detailsOf( starter ) {
	const resolved = resolve( starter.blocks[ 0 ]?.attributes ?? {} );
	const parts = [];

	if ( starter.steps ) {
		parts.push(
			sprintf(
				/* translators: %d: number of steps. */
				__( '%d steps', 'modal-kit' ),
				starter.steps
			)
		);
	}

	starter.features
		.filter(
			( name ) =>
				name !== 'multi-step' &&
				// The Video layout already says so.
				! ( name === 'video' && resolved.layout === 'video' )
		)
		.forEach( ( name ) => parts.push( FEATURE_LABELS[ name ] ) );

	const desktop = layoutName( resolved.layout );
	const mobile = MOBILE_LABELS[ resolved.mobile ] ?? desktop;
	parts.push( desktop === mobile ? desktop : `${ desktop } → ${ mobile }` );

	return parts;
}

/**
 * Live preview with a device switch. Modal Kit Pro turns it on with
 * the `modalKit.pickerPreview` filter.
 *
 * @param {Object}     props         Props.
 * @param {Object}     props.starter Selected starter.
 * @param {() => void} props.onUse   Uses it.
 * @return {Element} Pane.
 */
function PreviewPane( { starter, onUse } ) {
	const [ device, setDevice ] = useState( 'desktop' );

	return (
		<aside
			className="modal-kit-picker__pane"
			aria-label={ __( 'Preview', 'modal-kit' ) }
		>
			<div
				className="modal-kit-picker__devices"
				role="group"
				aria-label={ __( 'Preview size', 'modal-kit' ) }
			>
				{ [
					[ 'desktop', __( 'Desktop', 'modal-kit' ) ],
					[ 'mobile', __( 'Mobile', 'modal-kit' ) ],
				].map( ( [ name, label ] ) => (
					<Button
						key={ name }
						size="compact"
						isPressed={ device === name }
						onClick={ () => setDevice( name ) }
					>
						{ label }
					</Button>
				) ) }
			</div>
			<div
				className={ `modal-kit-picker__pane-preview is-${ device }` }
				aria-hidden="true"
			>
				<BlockPreview
					key={ device }
					blocks={ starter.blocks }
					viewportWidth={ device === 'mobile' ? 375 : 1200 }
				/>
			</div>
			<p className="modal-kit-picker__pane-title">
				<strong>{ starter.title }</strong>
			</p>
			<p className="modal-kit-picker__pane-details">
				{ detailsOf( starter ).join( ' · ' ) }
			</p>
			<p className="modal-kit-picker__pane-details">
				{ styleLine( starter ) }
			</p>
			<Button variant="primary" onClick={ onUse } __next40pxDefaultSize>
				{ __( 'Use template', 'modal-kit' ) }
			</Button>
		</aside>
	);
}

function categoryLabels() {
	return {
		...( window.modalKitEditor?.categories ?? {} ),
		[ THEME_CATEGORY ]: __( 'From your theme', 'modal-kit' ),
		[ USER_CATEGORY ]: __( 'My patterns', 'modal-kit' ),
	};
}

function matches( starter, search ) {
	if ( ! search ) {
		return true;
	}

	const haystack = [ starter.title, starter.description, ...starter.keywords ]
		.join( ' ' )
		.toLowerCase();

	return haystack.includes( search.toLowerCase() );
}

/**
 * A Pro template, shown as a listing: a sketch, not a pattern.
 *
 * @param {Object}     props            Props.
 * @param {Object}     props.sample     Sample from the server listing.
 * @param {boolean}    props.isSelected Selected.
 * @param {() => void} props.onSelect   Select handler.
 * @return {Element} Card.
 */
function ProCard( { sample, isSelected, onSelect } ) {
	return (
		<div className="modal-kit-picker__card-wrap" role="listitem">
			<button
				type="button"
				className="modal-kit-picker__card is-pro"
				aria-pressed={ isSelected }
				onClick={ onSelect }
			>
				<span
					className="modal-kit-picker__preview modal-kit-picker__sketch"
					aria-hidden="true"
				>
					<Glyph layout={ sample.layout } />
					<span>{ sample.text }</span>
					<span className="modal-kit-picker__sketch-button">
						{ sample.button }
					</span>
				</span>
				<span className="modal-kit-picker__title">
					{ sample.title }{ ' ' }
					<span className="modal-kit-pro-badge">
						{ __( 'PRO', 'modal-kit' ) }
					</span>
				</span>
				<span className="modal-kit-picker__layout">
					{ layoutName( sample.layout ) }
				</span>
			</button>
		</div>
	);
}

function StarterCard( { starter, isSelected, onSelect, onUse } ) {
	return (
		<div className="modal-kit-picker__card-wrap" role="listitem">
			<button
				type="button"
				className="modal-kit-picker__card"
				aria-pressed={ isSelected }
				onClick={ onSelect }
				onDoubleClick={ onUse }
			>
				<span className="modal-kit-picker__preview" aria-hidden="true">
					<BlockPreview
						blocks={ starter.blocks }
						viewportWidth={ 1200 }
					/>
				</span>
				<span className="modal-kit-picker__title">
					{ starter.title }
					{ starter.collection && (
						<>
							{ ' ' }
							<span className="modal-kit-pro-badge">
								{ __( 'PRO', 'modal-kit' ) }
							</span>
						</>
					) }
				</span>
				<span className="modal-kit-picker__layout">
					{ layoutName( starter.layout ) }
				</span>
			</button>
		</div>
	);
}

/**
 * Asks before a template replaces what is already in the modal.
 *
 * @param {Object}     props           Props.
 * @param {Object}     props.starter   Template.
 * @param {() => void} props.onConfirm Replaces the content.
 * @param {() => void} props.onCancel  Goes back to the picker.
 * @return {Element} Dialog.
 */
function ConfirmReplace( { starter, onConfirm, onCancel } ) {
	return (
		<Modal
			className="modal-kit-picker__confirm"
			title={ sprintf(
				/* translators: %s: template name. */
				__( 'Replace this modal with “%s”?', 'modal-kit' ),
				starter.title
			) }
			onRequestClose={ onCancel }
			size="medium"
		>
			<p>
				{ __(
					'The modal’s blocks and look (layout, size, colors) are replaced by the template’s.',
					'modal-kit'
				) }
			</p>
			<p>
				{ __(
					'Triggers, targeting, frequency and the title stay as they are. You can undo this.',
					'modal-kit'
				) }
			</p>
			<div className="modal-kit-picker__confirm-actions">
				<Button
					variant="tertiary"
					onClick={ onCancel }
					__next40pxDefaultSize
				>
					{ __( 'Cancel', 'modal-kit' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ onConfirm }
					__next40pxDefaultSize
				>
					{ __( 'Replace content', 'modal-kit' ) }
				</Button>
			</div>
		</Modal>
	);
}

/**
 * The picker dialog.
 *
 * @param {Object}     props           Props.
 * @param {() => void} props.onClose   Closes the picker.
 * @param {boolean}    props.replacing Changing the template of an existing modal.
 * @return {Element} Picker.
 */
export function PatternPicker( { onClose, replacing = false } ) {
	// The modal's style: the Settings default on a new modal, or its own.
	const currentModal = useSelect( ( select ) => {
		const { getBlockAttributes, getBlockName, getBlockOrder } =
			select( blockEditorStore );
		const [ first ] = getBlockOrder();

		return first && getBlockName( first ) === MODAL_BLOCK
			? getBlockAttributes( first )
			: null;
	}, [] );
	const patterns = useStarterPatterns();
	const starters = useMemo(
		() =>
			currentModal
				? patterns.map( ( starter ) =>
						withStyle( starter, currentModal )
					)
				: patterns,
		[ patterns, currentModal ]
	);
	const labels = categoryLabels();
	const [ category, setCategory ] = useState( 'all' );
	// Types inside the open collection (e.g. Popups: Newsletter, Coupon…).
	const [ type, setType ] = useState( 'all' );
	const types = Object.entries(
		window.modalKitEditor?.collectionTypes?.[ category ] ?? {}
	)
		.map( ( [ name, label ] ) => ( {
			name,
			label,
			count: starters.filter( ( starter ) =>
				starter.categories.includes( name )
			).length,
		} ) )
		.filter( ( item ) => item.count );

	useEffect( () => setType( 'all' ), [ category ] );
	const [ layout, setLayout ] = useState( 'all' );
	// Add-on layouts get a filter once a starter uses them.
	const filterOrder = [
		...FILTER_ORDER,
		...[
			...new Set( starters.map( ( starter ) => starter.layout ) ),
		].filter(
			( name ) =>
				name && ! LAYOUT_FILTER_LABELS[ name ] && allLayouts()[ name ]
		),
	];
	const [ search, setSearch ] = useState( '' );
	const [ selected, setSelected ] = useState( null );
	const [ proSelected, setProSelected ] = useState( null );
	const [ features, setFeatures ] = useState( [] );
	const collections = window.modalKitEditor?.collections ?? {};
	const showPreview = applyFilters( 'modalKit.pickerPreview', false );
	const [ proDismissed, setProDismissed ] = useState( false );
	const [ proListing ] = listings( 'picker' );
	const pro = proDismissed ? undefined : proListing;
	const navRef = useRef();
	const dismissPro = () => {
		dismiss( pro.key );
		setProDismissed( true );
		setProSelected( null );

		if ( category.startsWith( 'pro:' ) ) {
			setCategory( 'all' );
		}

		// The button that had focus is about to go.
		navRef.current?.querySelector( 'button' )?.focus();
	};
	const { resetEditorBlocks, editPost } = useDispatch( editorStore );
	const registry = useRegistry();
	const { replaceBlocks, replaceInnerBlocks, updateBlockAttributes } =
		useDispatch( blockEditorStore );
	const { getBlock } = useSelect( blockEditorStore );
	const [ confirming, setConfirming ] = useState( null );
	const { title, rootBlocks, meta } = useSelect(
		( select ) => ( {
			title: select( editorStore ).getEditedPostAttribute( 'title' ),
			rootBlocks: select( blockEditorStore ).getBlockOrder(),
			meta: select( editorStore ).getEditedPostAttribute( 'meta' ),
		} ),
		[]
	);

	const categories = useMemo( () => {
		const counts = {};
		starters.forEach( ( starter ) =>
			starter.categories.forEach( ( name ) => {
				counts[ name ] = ( counts[ name ] ?? 0 ) + 1;
			} )
		);

		const list = ( source ) =>
			Object.keys( source )
				.filter( ( name ) => counts[ name ] )
				.map( ( name ) => ( {
					name,
					label: source[ name ],
					count: counts[ name ],
				} ) )
				.sort( ( a, b ) => byName( a.label, b.label ) );

		return {
			categories: list( labels ),
			collections: list( collections ),
		};
	}, [ starters ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Video is a category (every starter with a video is in it), so it isn't
	// offered again as a feature.
	const usedFeatures = Object.keys( FEATURE_LABELS ).filter(
		( name ) =>
			name !== 'video' &&
			starters.some( ( starter ) => starter.features.includes( name ) )
	);

	const isProCategory = category.startsWith( 'pro:' );
	const proSamples = isProCategory ? ( pro?.samples ?? [] ) : [];

	const visible = starters
		.filter(
			( starter ) =>
				! isProCategory &&
				( category === 'all' ||
					starter.categories.includes( category ) ) &&
				( type === 'all' || starter.categories.includes( type ) ) &&
				( layout === 'all' || starter.layout === layout ) &&
				features.every( ( name ) =>
					starter.features.includes( name )
				) &&
				matches( starter, search )
		)
		.sort( ( a, b ) => byName( a.title, b.title ) );

	const apply = ( starter ) => {
		const blocks = starter.blocks.map( ( block ) => cloneBlock( block ) );
		const current = rootBlocks.length ? getBlock( rootBlocks[ 0 ] ) : null;
		const incoming = blocks.find( ( block ) => block.name === MODAL_BLOCK );

		if ( incoming && current?.name === MODAL_BLOCK ) {
			incoming.attributes = keepStyle(
				incoming.attributes,
				current.attributes
			);
		}

		if ( replacing && current?.name === MODAL_BLOCK && incoming ) {
			// The Modal block is locked against removal, so keep it: swap its
			// settings (keeping the lock) and inner blocks in one undo step.
			const cleared = Object.fromEntries(
				Object.keys( current.attributes ).map( ( key ) => [
					key,
					undefined,
				] )
			);

			registry.batch( () => {
				updateBlockAttributes( current.clientId, {
					...cleared,
					...incoming.attributes,
					lock: current.attributes.lock,
				} );
				replaceInnerBlocks( current.clientId, incoming.innerBlocks );
			} );
		} else if ( replacing && rootBlocks.length ) {
			replaceBlocks( rootBlocks, blocks );
		} else {
			resetEditorBlocks( blocks );
		}

		if ( ! title ) {
			editPost( { title: starter.title } );
		}

		const settings = starterMeta( starter, meta );

		if ( settings ) {
			editPost( { meta: settings } );
		}

		onClose();
	};

	const use = ( starter ) =>
		replacing && rootBlocks.length
			? setConfirming( starter )
			: apply( starter );

	if ( confirming ) {
		return (
			<ConfirmReplace
				starter={ confirming }
				onConfirm={ () => apply( confirming ) }
				onCancel={ () => setConfirming( null ) }
			/>
		);
	}

	return (
		<Modal
			className="modal-kit-picker"
			title={
				replacing
					? __( 'Change template', 'modal-kit' )
					: __( 'Choose a starting layout', 'modal-kit' )
			}
			onRequestClose={ onClose }
			isFullScreen
			headerActions={
				<SearchControl
					__nextHasNoMarginBottom
					className="modal-kit-picker__search"
					label={ __( 'Search patterns', 'modal-kit' ) }
					placeholder={ __( 'Search patterns', 'modal-kit' ) }
					value={ search }
					onChange={ setSearch }
				/>
			}
		>
			<div className="modal-kit-picker__body">
				<nav
					ref={ navRef }
					className="modal-kit-picker__categories"
					aria-label={ __( 'Pattern categories', 'modal-kit' ) }
				>
					{ [
						{
							name: 'all',
							label: __( 'All', 'modal-kit' ),
							count: starters.length,
						},
						...categories.categories,
					].map( ( item ) => (
						<Button
							key={ item.name }
							className="modal-kit-picker__category"
							isPressed={ category === item.name }
							onClick={ () => setCategory( item.name ) }
							__next40pxDefaultSize
						>
							<span>{ item.label }</span>
							<span className="modal-kit-picker__count">
								{ item.count }
							</span>
						</Button>
					) ) }
					{ categories.collections.length > 0 && (
						<>
							<p className="modal-kit-picker__nav-heading">
								{ __( 'Collections', 'modal-kit' ) }
							</p>
							{ categories.collections.map( ( item ) => (
								<Button
									key={ item.name }
									className="modal-kit-picker__category"
									isPressed={ category === item.name }
									onClick={ () => setCategory( item.name ) }
									__next40pxDefaultSize
								>
									<span>{ item.label }</span>
									<span className="modal-kit-picker__count">
										{ item.count }
									</span>
								</Button>
							) ) }
						</>
					) }
					{ usedFeatures.length > 0 && (
						<fieldset className="modal-kit-picker__features">
							<legend className="modal-kit-picker__nav-heading">
								{ __( 'Features', 'modal-kit' ) }
							</legend>
							{ usedFeatures.map( ( name ) => (
								<CheckboxControl
									key={ name }
									__nextHasNoMarginBottom
									label={ FEATURE_LABELS[ name ] }
									checked={ features.includes( name ) }
									onChange={ ( checked ) =>
										setFeatures( ( current ) =>
											checked
												? [ ...current, name ]
												: current.filter(
														( item ) =>
															item !== name
													)
										)
									}
								/>
							) ) }
						</fieldset>
					) }
					{ pro && (
						<>
							<p className="modal-kit-picker__nav-heading">
								{ __( 'Pro collections', 'modal-kit' ) }{ ' ' }
								<span className="modal-kit-pro-badge">
									{ __( 'PRO', 'modal-kit' ) }
								</span>
							</p>
							{ [ ...pro.groups ]
								.sort( ( a, b ) => byName( a.name, b.name ) )
								.map( ( group ) => (
									<Button
										key={ group.name }
										className="modal-kit-picker__category"
										isPressed={
											category === `pro:${ group.name }`
										}
										onClick={ () => {
											setCategory(
												`pro:${ group.name }`
											);
											setProSelected( null );
										} }
										__next40pxDefaultSize
									>
										<span>{ group.name }</span>
										<span className="modal-kit-picker__count">
											{ group.count }
										</span>
									</Button>
								) ) }
							<Button
								variant="link"
								className="modal-kit-picker__pro-dismiss"
								onClick={ dismissPro }
							>
								{ __( 'Not now', 'modal-kit' ) }
							</Button>
						</>
					) }
				</nav>

				<div className="modal-kit-picker__main">
					<p className="modal-kit-picker__hint">
						{ __(
							'Starters pick up your theme’s colors, fonts and spacing.',
							'modal-kit'
						) }
					</p>
					{ types.length > 0 && (
						<div
							className="modal-kit-picker__filters modal-kit-picker__types"
							role="group"
							aria-label={ __( 'Filter by type', 'modal-kit' ) }
						>
							{ [
								{
									name: 'all',
									label: sprintf(
										/* translators: %d: number of templates. */
										__( 'All %d', 'modal-kit' ),
										starters.filter( ( starter ) =>
											starter.categories.includes(
												category
											)
										).length
									),
								},
								...types,
							].map( ( item ) => (
								<Button
									key={ item.name }
									size="compact"
									className="modal-kit-picker__chip"
									isPressed={ type === item.name }
									onClick={ () => setType( item.name ) }
								>
									{ item.label }
								</Button>
							) ) }
						</div>
					) }
					<div
						className="modal-kit-picker__filters"
						role="group"
						aria-label={ __( 'Filter by layout', 'modal-kit' ) }
					>
						{ [ 'all', ...filterOrder ].map( ( name ) => (
							<Button
								key={ name }
								size="compact"
								className="modal-kit-picker__chip"
								isPressed={ layout === name }
								onClick={ () => setLayout( name ) }
							>
								{ name === 'all'
									? __( 'All layouts', 'modal-kit' )
									: layoutName( name ) }
							</Button>
						) ) }
					</div>

					<div
						className="modal-kit-picker__grid"
						role="list"
						aria-label={ __( 'Starters', 'modal-kit' ) }
					>
						{ proSamples.map( ( sample ) => (
							<ProCard
								key={ sample.title }
								sample={ sample }
								isSelected={
									proSelected?.title === sample.title
								}
								onSelect={ () => setProSelected( sample ) }
							/>
						) ) }
						{ visible.map( ( starter ) => (
							<StarterCard
								key={ starter.name }
								starter={ starter }
								isSelected={ selected?.name === starter.name }
								onSelect={ () => setSelected( starter ) }
								onUse={ () => use( starter ) }
							/>
						) ) }
						{ ! visible.length && ! proSamples.length && (
							<p className="modal-kit-picker__empty">
								{ __( 'No starters match.', 'modal-kit' ) }
							</p>
						) }
					</div>
				</div>
				{ showPreview && selected && ! isProCategory && (
					<PreviewPane
						starter={ selected }
						onUse={ () => use( selected ) }
					/>
				) }
			</div>

			{ isProCategory && proSelected && (
				<div className="modal-kit-picker__pro">
					<p>
						<strong>{ proSelected.title }</strong>{ ' ' }
						{ proSelected.uses }
					</p>
					<p>
						<ExternalLink href={ pro.url }>
							{ __( 'Get Pro', 'modal-kit' ) }
						</ExternalLink>
						{ ' · ' }
						<ExternalLink href={ pro.compare }>
							{ __( 'Compare plans', 'modal-kit' ) }
						</ExternalLink>
					</p>
					{ starters.some(
						( s ) => s.name === proSelected.lookalike
					) && (
						<p>
							{ __( 'Free look-alike:', 'modal-kit' ) }{ ' ' }
							{ proSelected.note }{ ' ' }
							<Button
								variant="link"
								onClick={ () =>
									use(
										starters.find(
											( s ) =>
												s.name === proSelected.lookalike
										)
									)
								}
							>
								{ __( 'Use it →', 'modal-kit' ) }
							</Button>
						</p>
					) }
				</div>
			) }

			<div className="modal-kit-picker__footer">
				<Button
					variant="secondary"
					onClick={ onClose }
					__next40pxDefaultSize
				>
					{ replacing
						? __( 'Keep current content', 'modal-kit' )
						: __( 'Start blank', 'modal-kit' ) }
				</Button>
				<Button
					variant="primary"
					disabled={ ! selected }
					accessibleWhenDisabled
					onClick={ () => selected && use( selected ) }
					__next40pxDefaultSize
				>
					{ selected
						? sprintf(
								/* translators: %s: pattern title. */
								__( 'Use “%s”', 'modal-kit' ),
								selected.title
							)
						: __( 'Choose a starter', 'modal-kit' ) }
				</Button>
			</div>
		</Modal>
	);
}

/**
 * Opens the picker once for a new modal, and whenever "Change template" is
 * chosen on the Modal block. A `mk_pattern` query argument (used by the
 * setup wizard) applies that starter straight away.
 *
 * @return {Element|null} Picker.
 */
export default function PatternPickerLauncher() {
	const { isNewModal } = useSelect( ( select ) => {
		const editor = select( editorStore );

		return {
			isNewModal:
				editor.getCurrentPostType() === POST_TYPE &&
				editor.isEditedPostNew(),
		};
	}, [] );
	const [ isOpen, setIsOpen ] = useState( false );
	const [ replacing, setReplacing ] = useState( false );
	const [ handled, setHandled ] = useState( false );

	useEffect( () => {
		const open = () => {
			setReplacing( true );
			setIsOpen( true );
		};

		window.addEventListener( OPEN_PICKER_EVENT, open );

		return () => window.removeEventListener( OPEN_PICKER_EVENT, open );
	}, [] );
	const { getEditedPostAttribute } = useSelect( editorStore );
	const starters = useStarterPatterns();
	const { resetEditorBlocks, editPost } = useDispatch( editorStore );

	useEffect( () => {
		if ( handled || ! isNewModal ) {
			return;
		}

		const requested = new URLSearchParams( window.location.search ).get(
			'mk_pattern'
		);

		if ( ! requested ) {
			setIsOpen( true );
			setHandled( true );
			return;
		}

		// The setup wizard's "Start blank" skips the picker.
		if ( requested === 'blank' ) {
			setHandled( true );
			return;
		}

		const starter = starters.find( ( item ) => item.name === requested );

		if ( starter ) {
			resetEditorBlocks(
				starter.blocks.map( ( block ) => cloneBlock( block ) )
			);
			editPost( { title: starter.title } );

			const settings = starterMeta(
				starter,
				getEditedPostAttribute( 'meta' )
			);

			if ( settings ) {
				editPost( { meta: settings } );
			}

			setHandled( true );
		}
	}, [ handled, isNewModal, starters ] ); // eslint-disable-line react-hooks/exhaustive-deps

	return isOpen ? (
		<PatternPicker
			replacing={ replacing }
			onClose={ () => {
				setIsOpen( false );
				setReplacing( false );
			} }
		/>
	) : null;
}

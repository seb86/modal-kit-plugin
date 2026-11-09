/**
 * Sidebar and toolbar controls for the Modal block.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	BlockControls,
	BlockSettingsMenuControls,
	InspectorControls,
	useSettings,
} from '@wordpress/block-editor';
import {
	BaseControl,
	Button,
	CheckboxControl,
	MenuItem,
	PanelBody,
	RangeControl,
	SelectControl,
	ToggleControl,
	ToolbarButton,
	ToolbarDropdownMenu,
	ToolbarGroup,
} from '@wordpress/components';
import { useInstanceId } from '@wordpress/compose';
import { useDispatch } from '@wordpress/data';
import { applyFilters } from '@wordpress/hooks';

import OverlayColorControl from '../../components/overlay-color';
import { StyleOptions } from '../../components/style-options';
import StylePicker from '../../components/style-picker';
import { STORE as PREVIEW, styleOf, withStyle } from '../../styles/preview';
import { fixedStyles } from '../../styles';
import Glyph from './glyphs';
import { openPicker } from '../../editor/pattern-picker/open';
import { allLayoutNames, allLayouts } from './layouts';

export const LAYOUT_LABELS = {
	centered: __( 'Center', 'modal-kit' ),
	corner: __( 'Corner', 'modal-kit' ),
	bar: __( 'Bar', 'modal-kit' ),
	full: __( 'Full', 'modal-kit' ),
	drawer: __( 'Drawer', 'modal-kit' ),
	split: __( 'Split', 'modal-kit' ),
	sheet: __( 'Sheet', 'modal-kit' ),
	inline: __( 'Inline', 'modal-kit' ),
	video: __( 'Video', 'modal-kit' ),
};

const POSITION_LABELS = {
	'bottom-right': __( 'Bottom right', 'modal-kit' ),
	'bottom-left': __( 'Bottom left', 'modal-kit' ),
	'top-right': __( 'Top right', 'modal-kit' ),
	'top-left': __( 'Top left', 'modal-kit' ),
	top: __( 'Top', 'modal-kit' ),
	bottom: __( 'Bottom', 'modal-kit' ),
	right: __( 'Right', 'modal-kit' ),
	left: __( 'Left', 'modal-kit' ),
	'media-left': __( 'Media left', 'modal-kit' ),
	'media-right': __( 'Media right', 'modal-kit' ),
	'media-top': __( 'Media top', 'modal-kit' ),
};

const MOBILE_LABELS = {
	auto: __( 'Automatic', 'modal-kit' ),
	same: __( 'Same as desktop', 'modal-kit' ),
	sheet: __( 'Bottom sheet', 'modal-kit' ),
	full: __( 'Full screen', 'modal-kit' ),
	centered: __( 'Centered dialog', 'modal-kit' ),
};

const AUTO_MOBILE_HELP = {
	centered: __( 'Full width minus the gutter, buttons stack.', 'modal-kit' ),
	corner: __( 'A full-width toast at the bottom.', 'modal-kit' ),
	bar: __( 'Moves to the bottom, within thumb reach.', 'modal-kit' ),
	full: __( 'Stays full screen.', 'modal-kit' ),
	drawer: __( '85% of the screen width.', 'modal-kit' ),
	split: __(
		'A bottom sheet with the image as a short header.',
		'modal-kit'
	),
	sheet: __( 'A full-width bottom sheet.', 'modal-kit' ),
	inline: __( 'Stays in the content flow.', 'modal-kit' ),
	video: __( 'Full screen, the video fills the width.', 'modal-kit' ),
};

/**
 * A layout's name in the editor; add-on layouts bring their own.
 *
 * @param {string} name Layout.
 * @return {string} Label.
 */
export function layoutLabel( name ) {
	return LAYOUT_LABELS[ name ] ?? allLayouts()[ name ]?.label ?? name;
}

/**
 * A position's name; add-on layouts bring their own (`positionLabels`).
 *
 * @param {string} position  Position.
 * @param {Object} layoutDef The layout.
 * @return {string} Label.
 */
function positionLabel( position, layoutDef ) {
	return (
		POSITION_LABELS[ position ] ??
		layoutDef?.positionLabels?.[ position ] ??
		position
	);
}

const SIZE_LABELS = {
	s: __( 'S', 'modal-kit' ),
	m: __( 'M', 'modal-kit' ),
	l: __( 'L', 'modal-kit' ),
	wide: __( 'Wide', 'modal-kit' ),
};

/**
 * This site's palettes (theme, default and custom) from the editor settings.
 *
 * @return {{origins: Object[], allowCustom: boolean}} Palettes.
 */
function usePalettes() {
	const [
		themeColors,
		defaultColors,
		customColors,
		allowCustom,
		showDefault,
	] = useSettings(
		'color.palette.theme',
		'color.palette.default',
		'color.palette.custom',
		'color.custom',
		'color.defaultPalette'
	);
	const origins = [
		[ __( 'Theme', 'modal-kit' ), themeColors ],
		[ __( 'Default', 'modal-kit' ), showDefault ? defaultColors : [] ],
		[ __( 'Custom', 'modal-kit' ), customColors ],
	]
		.filter( ( [ , colors ] ) => colors?.length )
		.map( ( [ name, colors ] ) => ( { name, colors } ) );

	return { origins, allowCustom };
}

/**
 * The overlay color control with this site's palettes.
 *
 * @param {Object}                    props            Props.
 * @param {Object}                    props.overlay    Overlay settings.
 * @param {(changes: Object) => void} props.setOverlay Updates the overlay settings.
 * @return {Element} Control.
 */
function OverlayColor( { overlay, setOverlay } ) {
	const { origins, allowCustom } = usePalettes();

	return (
		<OverlayColorControl
			origins={ origins }
			color={ overlay.color }
			customColor={ overlay.customColor }
			allowCustom={ allowCustom !== false }
			onChange={ setOverlay }
		/>
	);
}

/**
 * A layout drawn as a small page with the modal's shape in it.
 *
 * @param {Object} props      Props.
 * @param {string} props.name Layout.
 * @return {Element} Thumbnail.
 */
function LayoutThumb( { name } ) {
	return (
		<span
			className={ `modal-kit-layout-thumb is-${ name }` }
			aria-hidden="true"
		>
			{ name === 'split' && (
				<span className="modal-kit-layout-thumb__media" />
			) }
			<span className="modal-kit-layout-thumb__shape" />
		</span>
	);
}

/**
 * A row of pressed/unpressed buttons acting as a single choice.
 *
 * @param {Object}                  props              Props.
 * @param {string}                  props.label        Group label.
 * @param {string}                  props.value        Current value.
 * @param {Object[]}                props.options      { value, label, icon }.
 * @param {(value: string) => void} props.onChange     Change handler.
 * @param {string}                  props.help         Help text.
 * @param {boolean}                 [props.thumbnails] Show layout thumbnails, label hidden.
 * @return {Element} Control.
 */
function ChoiceGroup( {
	label,
	value,
	options,
	onChange,
	help,
	thumbnails = false,
} ) {
	const id = useInstanceId( ChoiceGroup, 'modal-kit-choice-group' );

	return (
		<BaseControl
			__nextHasNoMarginBottom
			id={ id }
			label={ label }
			hideLabelFromVision={ thumbnails }
			help={ help }
		>
			<div
				id={ id }
				className={ `modal-kit-choice-group${
					thumbnails ? ' has-thumbnails' : ''
				}` }
				role="radiogroup"
				aria-label={ label }
			>
				{ options.map( ( option ) => (
					<Button
						key={ option.value }
						role="radio"
						aria-checked={ value === option.value }
						isPressed={ value === option.value }
						onClick={ () => onChange( option.value ) }
						className="modal-kit-choice-group__option"
						__next40pxDefaultSize
					>
						{ option.icon }
						<span>{ option.label }</span>
					</Button>
				) ) }
			</div>
		</BaseControl>
	);
}

/**
 * What the Style panel edits: by default the Modal block's own style. An
 * add-on can point it at another block through the `modalKit.styleTarget`
 * filter (Modal Kit Pro: the A/B variant on the canvas), by wrapping this
 * hook and returning the same shape.
 *
 * @param {Object}                    props
 * @param {Object}                    props.attributes    Modal block attributes.
 * @param {(changes: Object) => void} props.setAttributes Updates them.
 * @return {Object} { title, value, options, onChange, onOptionsChange, preview, note, shared }.
 */
export function useOwnStyle( { attributes, setAttributes } ) {
	const options = {
		accent: 'style',
		accentColor: '',
		fonts: 'style',
		...( attributes.styleOptions ?? {} ),
	};

	return {
		title: __( 'Style', 'modal-kit' ),
		value: styleOf( attributes.className ),
		options,
		onChange: ( slug ) =>
			setAttributes( {
				className: withStyle( attributes.className, slug ) || undefined,
			} ),
		onOptionsChange: ( changes ) =>
			setAttributes( { styleOptions: { ...options, ...changes } } ),
		// What the canvas goes back to when a hover preview ends.
		preview: null,
		// Shown at the top of the Style panel.
		note: null,
		// Shown at the top of the panels whose settings every variant shares.
		shared: null,
	};
}

export default function Inspector( {
	attributes,
	resolved,
	setAttributes,
	backdrop,
	setBackdrop,
	clientId,
} ) {
	const { preview } = useDispatch( PREVIEW );
	const useStyleTarget = applyFilters( 'modalKit.styleTarget', useOwnStyle );
	const target = useStyleTarget( { clientId, attributes, setAttributes } );
	const targetSlug = fixedStyles()[ target.value ] ? target.value : '';
	const shared = target.shared ? (
		<p className="modal-kit-shared-note">{ target.shared }</p>
	) : null;
	const [ contentSize, wideSize ] = useSettings(
		'layout.contentSize',
		'layout.wideSize'
	);
	const { origins: paletteOrigins } = usePalettes();
	const layouts = allLayouts();
	const layoutNames = allLayoutNames();
	const layoutDef = layouts[ resolved.layout ];
	const fullScreen = [ resolved.layout, resolved.base ].some( ( name ) =>
		[ 'bar', 'full' ].includes( name )
	);
	const overlay = { ...resolved.overlay, ...( attributes.overlay ?? {} ) };
	const close = {
		...resolved.closeOptions,
		...( attributes.closeOptions ?? {} ),
	};

	const setOverlay = ( changes ) =>
		setAttributes( { overlay: { ...overlay, ...changes } } );
	const setClose = ( changes ) =>
		setAttributes( { closeOptions: { ...close, ...changes } } );

	const setLayout = ( layout ) =>
		setAttributes( {
			modalLayout: layout,
			position: layouts[ layout ].positions[ 0 ] ?? '',
		} );

	const sizeHelp = {
		s: __( 'S = two thirds of the theme content size.', 'modal-kit' ),
		m: sprintf(
			/* translators: %s: theme content size, e.g. 780px. */
			__( 'M = theme content size (%s).', 'modal-kit' ),
			contentSize ?? '—'
		),
		l: __( 'L = halfway between the content and wide sizes.', 'modal-kit' ),
		wide: sprintf(
			/* translators: %s: theme wide size, e.g. 1200px. */
			__( 'Wide = theme wide size (%s).', 'modal-kit' ),
			wideSize ?? '—'
		),
	}[ resolved.size ];

	return (
		<>
			<BlockControls group="block">
				<ToolbarDropdownMenu
					icon={ <Glyph layout={ resolved.layout } /> }
					label={ __( 'Layout', 'modal-kit' ) }
					controls={ layoutNames.map( ( name ) => ( {
						title: layoutLabel( name ),
						icon: <Glyph layout={ name } />,
						isActive: name === resolved.layout,
						onClick: () => setLayout( name ),
					} ) ) }
				/>
				{ layoutDef.positions.length > 0 && (
					<ToolbarDropdownMenu
						icon={ null }
						text={ positionLabel( resolved.position, layoutDef ) }
						label={ __( 'Position', 'modal-kit' ) }
						controls={ layoutDef.positions.map( ( position ) => ( {
							title: positionLabel( position, layoutDef ),
							isActive: position === resolved.position,
							onClick: () => setAttributes( { position } ),
						} ) ) }
					/>
				) }
			</BlockControls>
			<BlockControls group="other">
				<ToolbarButton onClick={ openPicker }>
					{ __( 'Change template', 'modal-kit' ) }
				</ToolbarButton>
			</BlockControls>
			<BlockSettingsMenuControls>
				{ ( { selectedClientIds, onClose } ) =>
					selectedClientIds.length === 1 && (
						<MenuItem
							onClick={ () => {
								onClose();
								openPicker();
							} }
						>
							{ __( 'Change template', 'modal-kit' ) }
						</MenuItem>
					)
				}
			</BlockSettingsMenuControls>
			<BlockControls group="other">
				<ToolbarGroup
					className="modal-kit-backdrop-toggle"
					title={ __( 'Backdrop', 'modal-kit' ) }
				>
					<ToolbarButton
						isPressed={ backdrop === 'site' }
						onClick={ () => setBackdrop( 'site' ) }
					>
						{ __( 'Site preview', 'modal-kit' ) }
					</ToolbarButton>
					<ToolbarButton
						isPressed={ backdrop === 'plain' }
						onClick={ () => setBackdrop( 'plain' ) }
					>
						{ __( 'Plain', 'modal-kit' ) }
					</ToolbarButton>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls group="styles">
				<PanelBody
					title={ target.title }
					className="modal-kit-styles-panel"
				>
					{ target.note }
					<StylePicker
						value={ target.value }
						onPreview={ ( slug ) =>
							slug
								? preview( clientId, slug )
								: preview(
										clientId,
										target.preview?.slug ?? null,
										target.preview?.options ?? null
									)
						}
						onChange={ target.onChange }
					/>
					{ /* Accent and Fonts below the tiles. */ }
					{ targetSlug && (
						<StyleOptions
							styleSlug={ targetSlug }
							value={ target.options }
							onChange={ target.onOptionsChange }
							colors={ paletteOrigins }
							themePrimary={
								window.modalKitEditor?.themePrimary ?? ''
							}
						/>
					) }
				</PanelBody>
			</InspectorControls>
			{ layoutDef.overlay && (
				<InspectorControls group="styles">
					<PanelBody
						title={ __( 'Overlay', 'modal-kit' ) }
						className="modal-kit-styles-panel"
					>
						{ shared }
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Show overlay', 'modal-kit' ) }
							checked={ !! overlay.show }
							onChange={ ( show ) => setOverlay( { show } ) }
						/>
						{ overlay.show && (
							<>
								<BaseControl
									__nextHasNoMarginBottom
									id="modal-kit-overlay-color"
									label={ __( 'Color', 'modal-kit' ) }
									hideLabelFromVision
									help={
										resolved.style.slug
											? __(
													'Leave empty to use the style’s overlay color.',
													'modal-kit'
												)
											: __(
													'Leave empty to use the text color.',
													'modal-kit'
												)
									}
								>
									<OverlayColor
										overlay={ overlay }
										setOverlay={ setOverlay }
									/>
								</BaseControl>
								<RangeControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={ __( 'Opacity', 'modal-kit' ) }
									value={ overlay.opacity }
									min={ 0 }
									max={ 100 }
									onChange={ ( opacity ) =>
										setOverlay( { opacity: opacity ?? 45 } )
									}
								/>
								<ToggleControl
									__nextHasNoMarginBottom
									label={ __(
										'Blur page behind',
										'modal-kit'
									) }
									checked={ !! overlay.blur }
									onChange={ ( blur ) =>
										setOverlay( { blur } )
									}
								/>
							</>
						) }
					</PanelBody>
				</InspectorControls>
			) }
			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'modal-kit' ) }>
					{ shared }
					<ChoiceGroup
						label={ __( 'Layout', 'modal-kit' ) }
						thumbnails
						value={ resolved.layout }
						onChange={ setLayout }
						options={ layoutNames.map( ( name ) => ( {
							value: name,
							label: layoutLabel( name ),
							icon: <LayoutThumb name={ name } />,
						} ) ) }
					/>
					{ layoutDef.positions.length > 0 && (
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'Position', 'modal-kit' ) }
							value={ resolved.position }
							options={ layoutDef.positions.map(
								( position ) => ( {
									value: position,
									label: positionLabel( position, layoutDef ),
								} )
							) }
							onChange={ ( position ) =>
								setAttributes( { position } )
							}
						/>
					) }
					{ resolved.layout !== 'inline' && (
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'On mobile', 'modal-kit' ) }
							value={ resolved.mobileLayout }
							options={ Object.entries( MOBILE_LABELS ).map(
								( [ value, label ] ) => ( {
									value,
									label,
								} )
							) }
							onChange={ ( mobileLayout ) =>
								setAttributes( { mobileLayout } )
							}
							help={
								resolved.mobileLayout === 'auto'
									? ( AUTO_MOBILE_HELP[ resolved.layout ] ??
										layoutDef.mobileHelp )
									: undefined
							}
						/>
					) }
				</PanelBody>

				{ ! fullScreen && (
					<PanelBody title={ __( 'Size', 'modal-kit' ) }>
						<ChoiceGroup
							label={ __( 'Size', 'modal-kit' ) }
							value={ resolved.size }
							onChange={ ( size ) => setAttributes( { size } ) }
							help={ sizeHelp }
							options={ Object.entries( SIZE_LABELS ).map(
								( [ value, label ] ) => ( {
									value,
									label,
								} )
							) }
						/>
					</PanelBody>
				) }

				{ layoutDef.closable !== false && (
					<PanelBody title={ __( 'Closing', 'modal-kit' ) }>
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'Close button (×)', 'modal-kit' ) }
							checked={ !! close.button }
							onChange={ ( button ) => setClose( { button } ) }
						/>
						{ close.button && resolved.layout !== 'full' && (
							<CheckboxControl
								__nextHasNoMarginBottom
								label={ __(
									'Show a visible “Close” label',
									'modal-kit'
								) }
								checked={ !! close.visibleLabel }
								onChange={ ( visibleLabel ) =>
									setClose( { visibleLabel } )
								}
							/>
						) }
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'Esc key', 'modal-kit' ) }
							checked={ !! close.esc }
							onChange={ ( esc ) => setClose( { esc } ) }
						/>
						{ layoutDef.overlay && (
							<CheckboxControl
								__nextHasNoMarginBottom
								label={ __( 'Click outside', 'modal-kit' ) }
								checked={ !! close.outside }
								onChange={ ( outside ) =>
									setClose( { outside } )
								}
							/>
						) }
					</PanelBody>
				) }

				<PanelBody
					title={ __( 'Animation', 'modal-kit' ) }
					initialOpen={ false }
				>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Animation', 'modal-kit' ) }
						value={ resolved.animation }
						options={ [
							{
								value: 'fade-rise',
								label: __( 'Fade + rise', 'modal-kit' ),
							},
							{ value: 'fade', label: __( 'Fade', 'modal-kit' ) },
							{ value: 'none', label: __( 'None', 'modal-kit' ) },
						] }
						onChange={ ( animation ) =>
							setAttributes( { animation } )
						}
						help={ __(
							'Always replaced by a simple fade when the visitor prefers reduced motion.',
							'modal-kit'
						) }
					/>
				</PanelBody>
			</InspectorControls>
		</>
	);
}

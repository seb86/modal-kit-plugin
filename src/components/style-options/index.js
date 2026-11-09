/**
 * The Style dropdown, grouped into styles that follow the theme and the
 * Modal Kit styles, and the two overrides a Modal Kit
 * style gets: Accent (style, theme primary, custom) and Fonts (style fonts,
 * theme fonts). Used by Settings → Display and the Modal block (Styles →
 * Style options). Styles: _style.scss, imported by each screen's stylesheet.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	BaseControl,
	Button,
	ColorPalette,
	Dropdown,
	MenuGroup,
	MenuItem,
	NavigableMenu,
	Notice,
} from '@wordpress/components';
import { useInstanceId, useRefEffect } from '@wordpress/compose';
import { check } from '@wordpress/icons';

import { accentProblem, contrast, textOn } from '../../styles/contrast';
import { fixedStyles } from '../../styles';

/**
 * The styles that follow the theme (block styles in block.json).
 *
 * @return {Array<{value: string, label: string}>} Styles.
 */
export function themeStyles() {
	return [
		{ value: 'default', label: __( 'Native', 'modal-kit' ) },
		{ value: 'soft', label: __( 'Soft', 'modal-kit' ) },
		{ value: 'editorial', label: __( 'Editorial', 'modal-kit' ) },
	];
}

/**
 * On open, focus moves to the chosen style (else the first), like a select.
 */
function useFocusSelected() {
	return useRefEffect( ( node ) => {
		(
			node.querySelector( '[aria-checked="true"]' ) ??
			node.querySelector( '[role="menuitemradio"]' )
		)?.focus();
	}, [] );
}

function Swatches( { style } ) {
	return (
		<span className="modal-kit-style-swatches" aria-hidden="true">
			<span style={ { background: style.surface } } />
			<span style={ { background: style.accent } } />
		</span>
	);
}

/**
 * @param {Object}                  props             Props.
 * @param {string}                  props.id          Id of the toggle, for a label.
 * @param {string}                  props.value       Style slug ('default' for Native).
 * @param {(value: string) => void} props.onChange    Receives the slug.
 * @param {string}                  [props.placement] Popover placement.
 * @return {Element} Control.
 */
export function StyleSelect( {
	id,
	value,
	onChange,
	placement = 'bottom-start',
} ) {
	const fixed = fixedStyles();
	const focusSelected = useFocusSelected();
	const current =
		themeStyles().find( ( item ) => item.value === value )?.label ??
		fixed[ value ]?.label ??
		themeStyles()[ 0 ].label;

	const item = ( slug, label, onClose, swatches = null ) => (
		<MenuItem
			key={ slug }
			role="menuitemradio"
			isSelected={ value === slug }
			icon={ value === slug ? check : null }
			iconPosition="right"
			onClick={ () => {
				onChange( slug );
				onClose();
			} }
		>
			<span className="modal-kit-style-select__item">
				{ swatches }
				{ label }
			</span>
		</MenuItem>
	);

	return (
		<Dropdown
			className="modal-kit-style-select"
			// The menu focuses the chosen style itself (useFocusSelected).
			focusOnMount={ false }
			popoverProps={ { placement, shift: true } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					id={ id }
					className="modal-kit-style-select__toggle"
					onClick={ onToggle }
					aria-haspopup="true"
					aria-expanded={ isOpen }
					__next40pxDefaultSize
				>
					{ fixed[ value ] && <Swatches style={ fixed[ value ] } /> }
					<span>{ current }</span>
				</Button>
			) }
			renderContent={ ( { onClose } ) => (
				<NavigableMenu
					ref={ focusSelected }
					className="modal-kit-style-select__menu"
					role="menu"
				>
					<MenuGroup
						label={ __( 'Follows your theme', 'modal-kit' ) }
					>
						{ themeStyles().map( ( style ) =>
							item( style.value, style.label, onClose )
						) }
					</MenuGroup>
					{ Object.keys( fixed ).length > 0 && (
						<MenuGroup
							label={ __( 'Modal Kit styles', 'modal-kit' ) }
						>
							{ Object.entries( fixed ).map(
								( [ slug, style ] ) =>
									item(
										slug,
										style.label,
										onClose,
										<Swatches style={ style } />
									)
							) }
						</MenuGroup>
					) }
				</NavigableMenu>
			) }
		/>
	);
}

function Segmented( { label, hideLabel, value, options, onChange } ) {
	const id = useInstanceId( Segmented, 'modal-kit-segmented' );

	return (
		<BaseControl
			__nextHasNoMarginBottom
			id={ id }
			label={ label }
			hideLabelFromVision={ hideLabel }
		>
			<div
				id={ id }
				className="modal-kit-segmented is-stacked"
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
						__next40pxDefaultSize
					>
						{ option.visual }
						{ option.label }
					</Button>
				) ) }
			</div>
		</BaseControl>
	);
}

/**
 * @param {Object}                                               props                Props.
 * @param {string}                                               props.styleSlug      Fixed style slug.
 * @param {{accent: string, accentColor: string, fonts: string}} props.value          Options.
 * @param {(changes: Object) => void}                            props.onChange       Receives changed options.
 * @param {Object[]}                                             [props.colors]       Palettes for the custom accent: { name, colors }.
 * @param {string}                                               [props.themePrimary] The theme's primary color, if known.
 * @param {(label: string, control: Element) => Element}         [props.renderRow]    Wraps each control in a labelled row (Settings).
 * @return {Element|null} Controls.
 */
export function StyleOptions( {
	styleSlug,
	value,
	onChange,
	colors = [],
	themePrimary = '',
	renderRow,
} ) {
	const style = fixedStyles()[ styleSlug ];

	if ( ! style ) {
		return null;
	}

	const accent = value.accent ?? 'style';
	let accentColor = '';

	if ( accent === 'custom' ) {
		accentColor = value.accentColor;
	} else if ( accent === 'theme' ) {
		accentColor = themePrimary;
	}

	const problem = accentProblem( accentColor, style.surface );
	// Swatches and "Aa" samples on the options.
	const shown = accentColor || style.accent;
	const ratio = contrast( textOn( shown, '#fff', '#17151f' ), shown );
	const swatch = ( color ) => (
		<span
			className="modal-kit-style-options__swatch"
			aria-hidden="true"
			style={ { background: color } }
		/>
	);
	const sample = ( family ) => (
		<span
			className="modal-kit-style-options__aa"
			aria-hidden="true"
			style={ { fontFamily: family || 'inherit' } }
		>
			{ __( 'Aa', 'modal-kit' ) }
		</span>
	);
	const themeHead =
		( window.modalKitEditor ?? window.modalKitSettings )?.themeTile?.head ??
		'';
	const accentControls = (
		<div className="modal-kit-style-options">
			<Segmented
				label={ __( 'Accent', 'modal-kit' ) }
				hideLabel={ !! renderRow }
				value={ accent }
				options={ [
					{
						value: 'style',
						label: __( 'Style', 'modal-kit' ),
						visual: swatch( style.accent ),
					},
					{
						value: 'theme',
						label: __( 'Theme primary', 'modal-kit' ),
						visual: swatch( themePrimary || style.accent ),
					},
					{
						value: 'custom',
						label: __( 'Custom', 'modal-kit' ),
						visual: swatch(
							value.accentColor ||
								'conic-gradient(#e23,#fc3,#3c6,#39f,#93f,#e23)'
						),
					},
				] }
				onChange={ ( next ) =>
					onChange( {
						accent: next,
						accentColor:
							next === 'custom'
								? value.accentColor ||
									style.accent.toLowerCase()
								: value.accentColor,
					} )
				}
			/>
			{ accent === 'custom' && (
				<ColorPalette
					colors={ colors }
					value={ value.accentColor || undefined }
					clearable={ false }
					enableAlpha={ false }
					onChange={ ( next ) =>
						onChange( { accentColor: next ?? '' } )
					}
				/>
			) }
			{ ! problem && (
				<p className="modal-kit-style-options__ratio">
					{ sprintf(
						/* translators: %s: contrast ratio, e.g. 5.4. */
						__( 'Text %s:1 ✓', 'modal-kit' ),
						ratio.toFixed( 1 )
					) }
				</p>
			) }
			{ problem && (
				<Notice status="warning" isDismissible={ false }>
					{ sprintf(
						/* translators: %s: contrast ratio, e.g. 3.2. */
						__(
							'This accent is hard to read: %s:1 against its button text or the panel. Text needs at least 4.5:1.',
							'modal-kit'
						),
						problem.toFixed( 1 )
					) }
				</Notice>
			) }
		</div>
	);
	const fontControls = (
		<Segmented
			label={ __( 'Fonts', 'modal-kit' ) }
			hideLabel={ !! renderRow }
			value={ value.fonts ?? 'style' }
			options={ [
				{
					value: 'style',
					label: __( 'Style fonts', 'modal-kit' ),
					visual: sample( style.head ),
				},
				{
					value: 'theme',
					label: __( 'Theme fonts', 'modal-kit' ),
					visual: sample( themeHead ),
				},
			] }
			onChange={ ( fonts ) => onChange( { fonts } ) }
		/>
	);

	if ( renderRow ) {
		return (
			<>
				{ renderRow( __( 'Accent', 'modal-kit' ), accentControls ) }
				{ renderRow( __( 'Fonts', 'modal-kit' ), fontControls ) }
			</>
		);
	}

	return (
		<div className="modal-kit-style-options">
			{ accentControls }
			{ fontControls }
		</div>
	);
}

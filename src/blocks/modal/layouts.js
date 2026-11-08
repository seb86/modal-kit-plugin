/**
 * Layout resolution, mirroring includes/Layouts.php. Both read
 * schema/layouts.json so the editor and the front end use the same classes.
 */
import { applyFilters } from '@wordpress/hooks';

import data from '../../../schema/layouts.json';
import { resolveStyle, styleClasses, styleTokens } from '../../styles';

export const LAYOUTS = data.layouts;
export const LAYOUT_NAMES = Object.keys( data.layouts );
export const SIZES = data.sizes;
export const MOBILE_CHOICES = data.mobileChoices;
export const ANIMATIONS = data.animations;

/**
 * Every layout, with those added by add-ons (Pro: the age gate) through the
 * `modalKit.layouts` filter, the editor twin of PHP's `modal_kit_layouts`.
 * Besides the keys in layouts.json, a layout may set `base` (a built-in
 * layout whose styles it extends), `closable` (false: no close button, Esc
 * or click outside), and the editor's `label`, `positionLabels`, `mobileHelp` and
 * `triggerNote` (shown in the Triggers panel instead of its triggers).
 *
 * @return {Object<string, Object>} Layouts by name.
 */
export function allLayouts() {
	const layouts = applyFilters( 'modalKit.layouts', data.layouts );

	return layouts?.centered ? layouts : data.layouts;
}

/**
 * @return {string[]} Every layout name, built-in ones first.
 */
export function allLayoutNames() {
	return Object.keys( allLayouts() );
}

const OVERLAY_DEFAULTS = {
	show: true,
	color: '',
	customColor: '',
	opacity: 45,
	blur: false,
};
const CLOSE_DEFAULTS = {
	button: true,
	esc: true,
	outside: true,
	visibleLabel: false,
};

/**
 * The effective mobile layout class suffix.
 *
 * @param {string} layout   Desktop layout.
 * @param {string} position Desktop position.
 * @param {string} choice   auto | same | sheet | full | centered.
 * @return {string} Mobile layout.
 */
export function mobileLayout( layout, position, choice ) {
	if ( layout === 'inline' ) {
		return 'inline';
	}

	if ( choice === 'auto' ) {
		return ( allLayouts()[ layout ] ?? LAYOUTS.centered ).mobile;
	}

	if ( choice === 'same' ) {
		return layout === 'bar' ? `bar-${ position }` : layout;
	}

	return choice;
}

/**
 * A custom color from the color picker: hex, rgb(a) or hsl(a), else ''.
 *
 * @param {unknown} value Value.
 * @return {string} Color.
 */
export function cssColor( value ) {
	const color = typeof value === 'string' ? value.trim() : '';

	return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test( color ) ||
		/^(?:rgb|hsl)a?\([\d\s.,%/deg]+\)$/i.test( color )
		? color
		: '';
}

/**
 * Normalises Modal block attributes. The layout lives in `modalLayout`,
 * because `layout` belongs to the layout block support.
 *
 * @param {Object} attributes Block attributes.
 * @return {Object} Resolved attributes.
 */
export function resolve( attributes = {} ) {
	const layouts = allLayouts();
	const layout = layouts[ attributes.modalLayout ]
		? attributes.modalLayout
		: 'centered';
	const def = layouts[ layout ];
	const closable = def.closable !== false;
	const position = def.positions.includes( attributes.position )
		? attributes.position
		: ( def.positions[ 0 ] ?? '' );
	const size = SIZES.includes( attributes.size ) ? attributes.size : 'm';
	const choice = MOBILE_CHOICES.includes( attributes.mobileLayout )
		? attributes.mobileLayout
		: 'auto';
	const overlay = { ...OVERLAY_DEFAULTS, ...( attributes.overlay ?? {} ) };
	const close = { ...CLOSE_DEFAULTS, ...( attributes.closeOptions ?? {} ) };

	return {
		layout,
		position,
		size,
		mobileLayout: choice,
		mobile: mobileLayout( layout, position, choice ),
		overlay: {
			show: def.overlay && !! overlay.show,
			color: String( overlay.color ?? '' ),
			customColor: cssColor( overlay.customColor ),
			opacity: Math.max(
				0,
				Math.min( 100, Number( overlay.opacity ) || 0 )
			),
			blur: !! overlay.blur,
		},
		closeOptions: {
			button: closable && !! close.button,
			esc: closable && !! close.esc,
			outside: closable && !! close.outside,
			visibleLabel: layout === 'full' || !! close.visibleLabel,
		},
		animation: ANIMATIONS.includes( attributes.animation )
			? attributes.animation
			: 'fade-rise',
		modal: def.modal,
		base: layouts[ def.base ] ? def.base : '',
		style: resolveStyle( attributes ),
	};
}

/**
 * Classes for the modal container.
 *
 * @param {Object} resolved Output of resolve().
 * @return {string[]} Class names.
 */
export function containerClasses( resolved ) {
	const classes = [
		'modal-kit',
		`modal-kit--${ resolved.layout }`,
		...( resolved.base ? [ `modal-kit--${ resolved.base }` ] : [] ),
		`modal-kit--size-${ resolved.size }`,
		`modal-kit--m-${ resolved.mobile }`,
		`modal-kit--anim-${ resolved.animation }`,
	];

	if ( resolved.position ) {
		classes.push( `modal-kit--pos-${ resolved.position }` );
	}

	if ( resolved.overlay.show ) {
		classes.push( 'has-overlay' );

		if ( resolved.overlay.blur ) {
			classes.push( 'has-overlay-blur' );
		}
	}

	return [ ...classes, ...styleClasses( resolved.style ) ];
}

/**
 * CSS variables for the modal container.
 *
 * @param {Object} resolved Output of resolve().
 * @return {Object} Style object.
 */
export function containerStyle( resolved ) {
	const style = {};

	if ( resolved.overlay.show ) {
		if ( resolved.overlay.color ) {
			style[ '--modal-kit-overlay-color' ] =
				`var(--wp--preset--color--${ resolved.overlay.color })`;
		} else if ( resolved.overlay.customColor ) {
			style[ '--modal-kit-overlay-color' ] = resolved.overlay.customColor;
		}
		style[ '--modal-kit-overlay-opacity' ] = resolved.overlay.opacity / 100;
	}

	return { ...style, ...styleTokens( resolved.style ) };
}

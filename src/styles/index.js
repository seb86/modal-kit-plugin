/**
 * Fixed styles, mirroring includes/Styles.php: which block style
 * is a fixed one, and the dialog classes and inline accent tokens it gets.
 */
import { textOn } from './contrast';
import fieldnote from './fieldnote.json';
import harbor from './harbor.json';
import night from './night.json';

export const ACCENTS = [ 'style', 'theme', 'custom' ];
export const FONTS = [ 'style', 'theme' ];

/**
 * A style JSON in the shape Styles::for_js() prints.
 *
 * @param {Object} style Style JSON.
 * @return {Object} Label and colors.
 */
function summary( style ) {
	return {
		label: style.label,
		surface: style.color.surface,
		ink: style.color.ink,
		accent: style.color.accent,
		onAccent: style.color[ 'on-accent' ],
	};
}

const BUILT_IN = {
	fieldnote: summary( fieldnote ),
	harbor: summary( harbor ),
	night: summary( night ),
};

/**
 * Every fixed style, including those added by `modal_kit_styles` (printed
 * by PHP into the editor, Settings and wizard data).
 *
 * @return {Object<string, Object>} Styles by slug.
 */
export function fixedStyles() {
	const data =
		typeof window === 'undefined'
			? null
			: ( window.modalKitEditor?.styles ??
				window.modalKitSettings?.styles ??
				window.modalKitWizard?.styles );

	return data && typeof data === 'object' && ! Array.isArray( data )
		? data
		: BUILT_IN;
}

/**
 * The style choice of a modal from its block attributes.
 *
 * @param {Object} attributes Block attributes.
 * @return {{slug: string, accent: string, accentColor: string, fonts: string}} Choice.
 */
export function resolveStyle( attributes = {} ) {
	const names = [
		...String( attributes.className ?? '' ).matchAll(
			/(?:^|\s)is-style-([a-z0-9_-]+)/g
		),
	].map( ( match ) => match[ 1 ] );
	const last = names[ names.length - 1 ];
	const slug = last && fixedStyles()[ last ] ? last : '';
	const options = attributes.styleOptions ?? {};
	let accent = ACCENTS.includes( options.accent ) ? options.accent : 'style';
	const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(
		options.accentColor ?? ''
	)
		? options.accentColor.toLowerCase()
		: '';

	if ( accent === 'custom' && ! color ) {
		accent = 'style';
	}

	return {
		slug,
		accent: slug ? accent : 'style',
		accentColor: slug && accent === 'custom' ? color : '',
		fonts: slug && options.fonts === 'theme' ? 'theme' : 'style',
	};
}

/**
 * Dialog classes for a style choice.
 *
 * @param {Object} choice resolveStyle() result.
 * @return {string[]} Classes.
 */
export function styleClasses( choice ) {
	if ( ! choice?.slug ) {
		return [];
	}

	return [
		'mk-style',
		`mk-style-${ choice.slug }`,
		...( choice.fonts === 'theme' ? [ 'mk-fonts-theme' ] : [] ),
	];
}

/**
 * Inline accent tokens for a style choice (see Styles::declarations_for).
 *
 * @param {Object} choice resolveStyle() result.
 * @return {Object<string, string>} Custom properties.
 */
export function styleTokens( choice ) {
	const style = choice?.slug ? fixedStyles()[ choice.slug ] : null;

	if ( ! style || choice.accent === 'style' ) {
		return {};
	}

	const accent =
		choice.accent === 'custom'
			? choice.accentColor
			: `var(--modal-kit-primary,${ style.accent })`;
	const onAccent =
		choice.accent === 'custom'
			? textOn( accent, '#fff', '#17151f' )
			: `var(--modal-kit-on-primary,${ style.onAccent })`;

	return {
		'--mk-accent': accent,
		'--mk-accent-strong': `color-mix(in srgb,${ accent } 78%,var(--mk-ink))`,
		'--mk-on-accent': onAccent,
		'--mk-full-accent': accent,
		'--mk-full-button': accent,
		'--mk-on-full-button': onAccent,
	};
}

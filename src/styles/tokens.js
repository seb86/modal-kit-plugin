/**
 * A fixed style's custom properties (plan §3.6): the `.mk-style-{slug}` rule
 * the front end, the editor and the Pro Style editor's preview use. The
 * style build (bin/build-styles.mjs) writes these rules for the bundled
 * styles; Styles.php writes the same for styles added at runtime
 * (Styles::tokens() mirrors tokens() below).
 */
import { luminance, parseColor } from './contrast.js';

/**
 * Normalizes a CSS value: lowercase hex, rgb() in modern notation, leading
 * zeros and double quotes, so the output passes the style linter.
 *
 * @param {string|number} value Value from the JSON file.
 * @return {string} CSS value.
 */
export function cssValue( value ) {
	return String( value )
		.replace( /#[0-9a-f]{3,8}\b/gi, ( hex ) =>
			hex.toLowerCase().replace( /^#(.)\1(.)\2(.)\3$/, '#$1$2$3' )
		)
		.replace( /rgba?\(([^)]*)\)/gi, ( match, args ) => {
			const [ r, g, b, a ] = args
				.split( /[\s,/]+/ )
				.filter( Boolean )
				.map( Number );

			return a === undefined || a === 1
				? `rgb(${ r } ${ g } ${ b })`
				: `rgb(${ r } ${ g } ${ b } / ${ Math.round( a * 100 ) }%)`;
		} )
		.replace( /(^|[\s(,])\.(\d)/g, '$10.$2' )
		.replace( /'/g, '"' );
}

/**
 * Mixes a hex color with black.
 *
 * @param {string} color  Hex color.
 * @param {number} amount 0 to 1, how much black.
 * @return {string} Hex color.
 */
function darken( color, amount ) {
	return (
		'#' +
		parseColor( color )
			.map( ( channel ) =>
				Math.round( channel * ( 1 - amount ) )
					.toString( 16 )
					.padStart( 2, '0' )
			)
			.join( '' )
	);
}

/**
 * The custom properties of one style.
 *
 * @param {Object} style Parsed style JSON.
 * @return {Array<[string, string]>} [name, value] pairs.
 */
export function tokens( style ) {
	const color = style.color ?? {};
	const font = style.font ?? {};
	const radius = style.radius ?? {};
	const dark = luminance( color.surface ) < 0.4;
	const list = [];

	for ( const [ name, value ] of Object.entries( color ) ) {
		// The overlay's color only: the modal's own Opacity setting decides
		// how much of it shows.
		list.push( [
			name,
			name === 'overlay'
				? cssValue( value ).replace( / \/ [\d.]+%\)$/, ')' )
				: cssValue( value ),
		] );
	}

	// Derived: fields sit a step away from the panel, and full-screen
	// buttons use the light ink, or the accent on dark styles.
	list.push(
		[
			'field-bg',
			cssValue( dark ? darken( color.surface, 0.25 ) : '#fff' ),
		],
		[
			'full-button',
			cssValue( dark ? color[ 'full-accent' ] : color[ 'full-ink' ] ),
		],
		[ 'on-full-button', cssValue( color[ 'full-bg' ] ) ],
		[ 'scheme', dark ? 'dark' : 'light' ]
	);

	for ( const key of [ 'head', 'body', 'mono' ] ) {
		if ( font[ key ] ) {
			list.push( [ `font-${ key }`, cssValue( font[ key ] ) ] );
		}
	}

	if ( font[ 'head-weight' ] ) {
		list.push( [ 'head-weight', cssValue( font[ 'head-weight' ] ) ] );
	}

	if ( font[ 'head-tracking' ] ) {
		list.push( [ 'head-tracking', cssValue( font[ 'head-tracking' ] ) ] );
	}

	// A larger heading (Harbor's serif) keeps the shared phone-to-desktop ramp.
	const headSize = parseFloat( font[ 'head-size' ] );

	if ( headSize ) {
		const min = Math.round( headSize * 0.8 );

		list.push( [
			'text-heading',
			`clamp(${ min }px, ${ min - 5 }px + 1.4vw, ${ headSize }px)`,
		] );
	}

	for ( const key of [ 'panel', 'button', 'field' ] ) {
		if ( radius[ key ] ) {
			list.push( [ `radius-${ key }`, cssValue( radius[ key ] ) ] );
		}
	}

	if ( style.shadow ) {
		list.push( [ 'shadow', cssValue( style.shadow ) ] );
	}

	return list.map( ( [ name, value ] ) => [ `--mk-${ name }`, value ] );
}

/**
 * The `.mk-style-{slug}` rule of a style.
 *
 * @param {string} slug  Class suffix.
 * @param {Object} style Parsed style.
 * @return {string} CSS.
 */
export function cssRule( slug, style ) {
	return `.mk-style-${ slug }{${ tokens( style )
		.map( ( [ name, value ] ) => `${ name }:${ value }` )
		.join( ';' ) }}`;
}

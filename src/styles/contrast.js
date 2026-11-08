/**
 * WCAG 2 contrast, shared by the style build, its unit test and the custom
 * accent warning in the editor and Settings.
 */

/**
 * Parses #rgb, #rrggbb (alpha digits are ignored) or rgb()/rgba().
 *
 * @param {string} color CSS color.
 * @return {number[]|null} [r, g, b] from 0 to 255, or null.
 */
export function parseColor( color ) {
	const value = String( color ?? '' ).trim();
	let match = value.match( /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i );

	if ( match ) {
		const hex =
			match[ 1 ].length <= 4
				? [ ...match[ 1 ].slice( 0, 3 ) ]
						.map( ( c ) => c + c )
						.join( '' )
				: match[ 1 ].slice( 0, 6 );

		return [ 0, 2, 4 ].map( ( i ) =>
			parseInt( hex.slice( i, i + 2 ), 16 )
		);
	}

	match = value.match( /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i );

	return match ? match.slice( 1, 4 ).map( Number ) : null;
}

/**
 * Relative luminance.
 *
 * @param {string} color CSS color.
 * @return {number} 0 (black) to 1 (white).
 */
export function luminance( color ) {
	const rgb = parseColor( color ) ?? [ 0, 0, 0 ];
	const [ r, g, b ] = rgb.map( ( channel ) => {
		const v = channel / 255;

		return v <= 0.03928
			? v / 12.92
			: Math.pow( ( v + 0.055 ) / 1.055, 2.4 );
	} );

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colors.
 *
 * @param {string} a CSS color.
 * @param {string} b CSS color.
 * @return {number} 1 to 21.
 */
export function contrast( a, b ) {
	const x = luminance( a );
	const y = luminance( b );

	return ( Math.max( x, y ) + 0.05 ) / ( Math.min( x, y ) + 0.05 );
}

/**
 * Light or dark text for a background, whichever contrasts more.
 *
 * @param {string} background CSS color.
 * @param {string} light      Light text color.
 * @param {string} dark       Dark text color.
 * @return {string} light or dark.
 */
export function textOn( background, light = '#FFFFFF', dark = '#17151F' ) {
	return contrast( light, background ) >= contrast( dark, background )
		? light
		: dark;
}

/**
 * The accent's contrast problems, if any: button text on the accent, and the
 * accent as text (links, eyebrows) on the panel.
 *
 * @param {string} accent  Accent color (hex).
 * @param {string} surface Panel color (hex).
 * @return {number|null} The lowest ratio when it's below 4.5:1, else null.
 */
export function accentProblem( accent, surface ) {
	if ( ! /^#[0-9a-f]{3,8}$/i.test( accent ?? '' ) ) {
		return null;
	}

	const lowest = Math.min(
		contrast( textOn( accent, '#fff', '#17151f' ), accent ),
		contrast( accent, surface )
	);

	return lowest < 4.5 ? lowest : null;
}

/**
 * A style drawn as a tiny modal from its own tokens (mockup 13a): surface,
 * ink, accent, heading font, weight and tracking, panel and button corners.
 * No screenshots, so a theme or imported style draws the same way. Styles:
 * _style.scss.
 */
import { __ } from '@wordpress/i18n';

import { fixedStyles } from '../../styles';
import { contrast } from '../../styles/contrast';

/**
 * Mixes two hex colours.
 *
 * @param {string} a      Hex colour.
 * @param {string} b      Hex colour.
 * @param {number} amount Share of b, 0 to 1.
 * @return {string} Hex colour.
 */
function mix( a, b, amount ) {
	const parse = ( hex ) =>
		/^#[0-9a-f]{6}$/i.test( hex )
			? [ 1, 3, 5 ].map( ( i ) => parseInt( hex.slice( i, i + 2 ), 16 ) )
			: null;
	const x = parse( a );
	const y = parse( b );

	if ( ! x || ! y ) {
		return a;
	}

	return (
		'#' +
		x
			.map( ( channel, i ) =>
				Math.round( channel + ( y[ i ] - channel ) * amount )
					.toString( 16 )
					.padStart( 2, '0' )
			)
			.join( '' )
	);
}

/**
 * The tokens a tile draws with, for any style the picker lists.
 *
 * @param {string} slug Style slug ('default', 'soft', 'editorial' or a fixed one).
 * @return {Object} { surface, ink, accent, onAccent, head, headWeight, headTracking, radiusPanel, radiusButton, size }.
 */
export function tileTokens( slug ) {
	const fixed = fixedStyles()[ slug ];

	if ( fixed ) {
		return { size: 1, ...fixed };
	}

	// The styles that follow the theme, from its resolved values.
	const theme =
		window.modalKitEditor?.themeTile ??
		window.modalKitSettings?.themeTile ??
		{};
	const surface = theme.surface || '#ffffff';
	const ink = theme.ink || '#1e1e1e';
	const accent = theme.accent || ink;
	const base = {
		surface,
		ink,
		accent,
		onAccent:
			contrast( '#fff', accent ) >= contrast( '#111', accent )
				? '#fff'
				: '#111',
		head: theme.head || 'inherit',
		headWeight: '600',
		headTracking: '0',
		radiusPanel: theme.radius || '4px',
		radiusButton: theme.radius || '4px',
		size: 1,
	};

	if ( slug === 'soft' ) {
		return {
			...base,
			surface: mix( surface, accent, 0.08 ),
			radiusPanel: '16px',
			radiusButton: '999px',
		};
	}

	if ( slug === 'editorial' ) {
		return {
			...base,
			surface: ink,
			ink: surface,
			accent: surface,
			onAccent: ink,
			headWeight: '700',
			size: 1.25,
		};
	}

	return base;
}

/**
 * @param {Object}  props          Props.
 * @param {string}  props.slug     Style slug.
 * @param {Object}  [props.tokens] Tokens to draw instead of the slug's (import preview).
 * @param {boolean} [props.small]  The list-row size (13b).
 * @return {Element} Tile drawing (decorative: the caller labels it).
 */
export default function StyleTile( { slug, tokens, small = false } ) {
	const t = tokens ?? tileTokens( slug );

	return (
		<span
			className={ `modal-kit-style-tile${ small ? ' is-small' : '' }` }
			aria-hidden="true"
			style={ {
				background: t.surface,
				color: t.ink,
				borderRadius: `min(${ t.radiusPanel || '6px' }, 10px)`,
			} }
		>
			<span
				className="modal-kit-style-tile__aa"
				style={ {
					fontFamily: t.head || 'inherit',
					fontWeight: t.headWeight || 600,
					letterSpacing: t.headTracking || 0,
					fontSize: `${ ( small ? 13 : 18 ) * ( t.size ?? 1 ) }px`,
				} }
			>
				{ __( 'Aa', 'modal-kit' ) }
			</span>
			<span
				className="modal-kit-style-tile__button"
				style={ {
					background: t.accent,
					borderRadius: `min(${ t.radiusButton || '4px' }, 999px)`,
				} }
			/>
		</span>
	);
}

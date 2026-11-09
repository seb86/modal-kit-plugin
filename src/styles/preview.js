/**
 * Style preview: hovering or arrowing over a tile shows that
 * style on the canvas without saving it, and without an undo step. The
 * picker writes the previewed slug here; the Modal block draws with it in
 * place of its own.
 */
import { createReduxStore, register } from '@wordpress/data';

export const STORE = 'modal-kit/style-preview';

/**
 * A className with its block style swapped: Native has none.
 *
 * @param {string} className Class names.
 * @param {string} slug      Style slug ('default' for Native).
 * @return {string} Class names.
 */
export function withStyle( className = '', slug = 'default' ) {
	const others = String( className )
		.split( /\s+/ )
		.filter( ( name ) => name && ! name.startsWith( 'is-style-' ) );

	return [
		...others,
		...( slug && slug !== 'default' ? [ `is-style-${ slug }` ] : [] ),
	].join( ' ' );
}

/**
 * The style a className applies ('default' when none).
 *
 * @param {string} className Class names.
 * @return {string} Slug.
 */
export function styleOf( className = '' ) {
	const names = [
		...String( className ).matchAll( /(?:^|\s)is-style-([a-z0-9_-]+)/g ),
	];

	return names.length ? names[ names.length - 1 ][ 1 ] : 'default';
}

const store = createReduxStore( STORE, {
	// clientId → { slug, options }: options are the Accent and Fonts choices
	// to draw with (add-ons: an A/B variant's own), else the block's.
	reducer( state = {}, action ) {
		if ( action.type === 'PREVIEW' ) {
			const next = { ...state };

			if ( action.slug ) {
				next[ action.clientId ] = {
					slug: action.slug,
					options: action.options ?? null,
				};
			} else {
				delete next[ action.clientId ];
			}

			return next;
		}

		return state;
	},
	actions: {
		preview: ( clientId, slug, options = null ) => ( {
			type: 'PREVIEW',
			clientId,
			slug,
			options,
		} ),
	},
	selectors: {
		get: ( state, clientId ) => state[ clientId ]?.slug ?? null,
		getOptions: ( state, clientId ) => state[ clientId ]?.options ?? null,
	},
} );

register( store );

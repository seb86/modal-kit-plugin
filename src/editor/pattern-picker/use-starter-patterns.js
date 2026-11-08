/**
 * Collects the starters for the picker: Modal Kit patterns, theme patterns
 * registered for the modal post type, and the user's own patterns that
 * contain a Modal block.
 */
import { createBlock, parse } from '@wordpress/blocks';
import { store as coreStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';

export const POST_TYPE = 'mk_modal';
export const THEME_CATEGORY = 'modal-kit-theme';
export const USER_CATEGORY = 'modal-kit-mine';
export const VIDEO_CATEGORY = 'modal-kit-video';

const LOCK = { move: true, remove: true };

/**
 * Parses pattern content into the post's blocks: one locked Modal block.
 * Content without a Modal block is wrapped in a default one.
 *
 * @param {string} content Serialised blocks.
 * @return {Object[]} Blocks.
 */
export function toModalBlocks( content ) {
	const blocks = parse( content );
	const modal = blocks.find( ( block ) => block.name === 'modal-kit/modal' );

	if ( modal ) {
		modal.attributes.lock = LOCK;
		return [ modal ];
	}

	return [ createBlock( 'modal-kit/modal', { lock: LOCK }, blocks ) ];
}

/**
 * The layout of a starter, read from its Modal block.
 *
 * @param {Object[]} blocks Parsed blocks.
 * @return {string} Layout name.
 */
export function layoutOf( blocks ) {
	return blocks[ 0 ]?.attributes?.modalLayout ?? 'centered';
}

/**
 * What a starter uses (2e feature filters), read from its content.
 *
 * @param {string}   content  Serialised blocks.
 * @param {string[]} keywords Pattern keywords.
 * @return {string[]} multi-step | form | countdown | video.
 */
export function featuresOf( content, keywords = [] ) {
	const features = [];

	if ( content.includes( '<!-- wp:modal-kit/step' ) ) {
		features.push( 'multi-step' );
	}
	if ( content.includes( '<!-- wp:modal-kit/form' ) ) {
		features.push( 'form' );
	}
	if (
		content.includes( '<!-- wp:modal-kit/countdown' ) ||
		keywords.includes( 'countdown' )
	) {
		features.push( 'countdown' );
	}
	if ( /<!-- wp:(video|embed)[ {]/.test( content ) ) {
		features.push( 'video' );
	}

	return features;
}

/**
 * Number of steps in a starter.
 *
 * @param {string} content Serialised blocks.
 * @return {number} Steps (0 for a single panel).
 */
function stepsOf( content ) {
	return ( content.match( /<!-- wp:modal-kit\/step[ {]/g ) ?? [] ).length;
}

export default function useStarterPatterns() {
	const { patterns, userPatterns } = useSelect( ( select ) => {
		const core = select( coreStore );

		return {
			patterns: core.getBlockPatterns() ?? [],
			userPatterns:
				core.getEntityRecords( 'postType', 'wp_block', {
					per_page: 100,
					context: 'edit',
				} ) ?? [],
		};
	}, [] );

	return useMemo( () => {
		const starters = [];
		// Every starter with a video belongs in the Video category, whatever
		// category or collection it was registered in.
		const withVideo = ( categories, features ) =>
			features.includes( 'video' ) &&
			! categories.includes( VIDEO_CATEGORY )
				? [ ...categories, VIDEO_CATEGORY ]
				: categories;
		const known = [
			...Object.keys( window.modalKitEditor?.categories ?? {} ),
			...Object.keys( window.modalKitEditor?.collections ?? {} ),
		];
		const collections = Object.keys(
			window.modalKitEditor?.collections ?? {}
		);

		for ( const pattern of patterns ) {
			const forModals = pattern.post_types?.includes( POST_TYPE );
			// Ours, or an add-on's in one of our categories or collections.
			const ours =
				pattern.name.startsWith( 'modal-kit/' ) ||
				( pattern.categories ?? [] ).some( ( name ) =>
					known.includes( name )
				);

			if ( ! forModals && ! ours ) {
				continue;
			}

			const blocks = toModalBlocks( pattern.content );
			const features = featuresOf( pattern.content, pattern.keywords );
			starters.push( {
				name: pattern.name,
				title: pattern.title,
				description: pattern.description,
				keywords: pattern.keywords ?? [],
				categories: withVideo(
					ours ? ( pattern.categories ?? [] ) : [ THEME_CATEGORY ],
					features
				),
				blocks,
				layout: layoutOf( blocks ),
				mobileLayout: blocks[ 0 ]?.attributes?.mobileLayout ?? '',
				features,
				steps: stepsOf( pattern.content ),
				collection: ( pattern.categories ?? [] ).some( ( name ) =>
					collections.includes( name )
				),
			} );
		}

		for ( const record of userPatterns ) {
			const content = record.content?.raw ?? '';

			if ( ! content.includes( '<!-- wp:modal-kit/modal' ) ) {
				continue;
			}

			const blocks = toModalBlocks( content );
			const features = featuresOf( content );
			starters.push( {
				name: `user/${ record.id }`,
				title: record.title?.raw || record.title?.rendered || '',
				description: '',
				keywords: [],
				categories: withVideo( [ USER_CATEGORY ], features ),
				blocks,
				layout: layoutOf( blocks ),
				mobileLayout: blocks[ 0 ]?.attributes?.mobileLayout ?? '',
				features,
				steps: stepsOf( content ),
				collection: false,
			} );
		}

		return starters;
	}, [ patterns, userPatterns ] );
}

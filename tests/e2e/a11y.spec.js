/**
 * Automated accessibility checks (axe) on what visitors get: an open modal in
 * every layout, every fixed style and every starter, on the active theme.
 * Axe can't confirm how a modal sounds in a screen reader; that's a manual check.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { AxeBuilder } = require( '@axe-core/playwright' );
const {
	createModal,
	deleteAllModals,
	freshStorage,
} = require( './utils/modals' );

const LAYOUTS = {
	centered: {},
	drawer: { modalLayout: 'drawer', position: 'right' },
	sheet: { modalLayout: 'sheet' },
	full: { modalLayout: 'full' },
	split: { modalLayout: 'split', position: 'media-left' },
	corner: { modalLayout: 'corner', position: 'bottom-right' },
	bar: { modalLayout: 'bar', position: 'bottom' },
};

const STYLES = [ 'fieldnote', 'harbor', 'night' ];

const STARTERS = [
	'monthly-letter',
	'discount-code',
	'shipping-notice',
	'parting-gift',
	'product-drop',
	'event-announcement',
	'video-tour',
];

/**
 * Opens a modal and returns what axe finds inside it.
 *
 * @param {Object} page Playwright page.
 * @return {Promise<string[]>} A line for each element with a problem.
 */
async function problems( page ) {
	await page.goto( '/?modal=a11y' );

	const dialog = page.locator( '#modal-a11y' );
	await expect( dialog ).toBeVisible();

	const { violations } = await new AxeBuilder( { page } )
		.include( '#modal-a11y' )
		.analyze();

	return violations.flatMap( ( { id, nodes } ) =>
		nodes.map(
			( node ) =>
				`${ id }: ${ node.target.join( ' ' ) } ${
					node.any[ 0 ]?.message ?? ''
				}`
		)
	);
}

test.describe( 'Accessibility (axe)', () => {
	test.beforeEach( async ( { page, requestUtils } ) => {
		await deleteAllModals( requestUtils );
		await freshStorage( page );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	for ( const [ name, attributes ] of Object.entries( LAYOUTS ) ) {
		test( `layout: ${ name }`, async ( { page, requestUtils } ) => {
			await createModal( requestUtils, { slug: 'a11y', attributes } );
			expect( await problems( page ) ).toEqual( [] );
		} );
	}

	// Axe doesn't check an icon against what's behind it. On a split the × can land
	// on the media, whatever colour that is, so it brings the panel's colour with it.
	for ( const [ position, className ] of [
		[ 'media-left' ],
		[ 'media-right' ],
		[ 'media-top' ],
		[ 'media-right', 'is-style-night' ],
	] ) {
		test( `split, ${ position }${
			className ? `, ${ className }` : ''
		}: the close button keeps the panel's colours`, async ( {
			page,
			requestUtils,
		} ) => {
			await createModal( requestUtils, {
				slug: 'a11y',
				attributes: { modalLayout: 'split', position, className },
			} );
			await page.goto( '/?modal=a11y' );

			const panel = page.locator( '#modal-a11y .modal-kit__panel' );
			const close = panel.locator( '> .modal-kit__close' );
			await expect( close ).toBeVisible();

			const backgrounds = await panel.evaluate( ( node ) => {
				const button = node.querySelector(
					':scope > .modal-kit__close'
				);
				return [ node, button ].map(
					( element ) =>
						window.getComputedStyle( element ).backgroundColor
				);
			} );
			expect( backgrounds[ 1 ] ).toBe( backgrounds[ 0 ] );
			expect( backgrounds[ 1 ] ).not.toBe( 'rgba(0, 0, 0, 0)' );

			// Still there with the pointer on it.
			await close.hover();
			expect(
				await close.evaluate(
					( node ) => window.getComputedStyle( node ).backgroundColor
				)
			).toBe( backgrounds[ 0 ] );
		} );
	}

	for ( const style of STYLES ) {
		test( `style: ${ style }`, async ( { page, requestUtils } ) => {
			await createModal( requestUtils, {
				slug: 'a11y',
				attributes: { className: `is-style-${ style }` },
			} );
			expect( await problems( page ) ).toEqual( [] );
		} );
	}

	for ( const starter of STARTERS ) {
		test( `starter: ${ starter }`, async ( { page, requestUtils } ) => {
			const patterns = await requestUtils.rest( {
				path: '/wp/v2/block-patterns/patterns',
			} );
			const { content } = patterns.find(
				( { name } ) => name === `modal-kit/${ starter }`
			);

			await requestUtils.rest( {
				path: '/wp/v2/mk_modal',
				method: 'POST',
				data: {
					title: 'a11y',
					slug: 'a11y',
					status: 'publish',
					content,
				},
			} );

			expect( await problems( page ) ).toEqual( [] );
		} );
	}
} );

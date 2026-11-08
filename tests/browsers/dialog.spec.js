/**
 * What browsers disagree on with a native dialog: the top layer, keeping focus
 * inside, scroll lock, closing animations and small screens. Runs on Firefox,
 * WebKit and two phones (`npm run test:browsers`).
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	freshStorage,
} = require( '../e2e/utils/modals' );

const filler = Array.from(
	{ length: 40 },
	( _, i ) =>
		`<!-- wp:paragraph --><p>Paragraph ${
			i + 1
		}. Notebooks, pens and essays for people who still think on paper.</p><!-- /wp:paragraph -->`
).join( '\n' );

const OVERLAYS = {
	centered: {},
	drawer: { modalLayout: 'drawer', position: 'right' },
	sheet: { modalLayout: 'sheet' },
	full: { modalLayout: 'full' },
	split: { modalLayout: 'split', position: 'media-left' },
};

let pageUrl;

/**
 * Opens the test page, ready for links.
 *
 * @param {Object} page Playwright page.
 */
async function visit( page ) {
	await page.goto( pageUrl );
	await page.waitForFunction( () =>
		document.documentElement.classList.contains( 'modal-kit-js' )
	);
}

/**
 * Notes every animation that moves something, from before it starts.
 *
 * @param {Object} page Playwright page.
 */
const watchMovement = ( page ) =>
	page.evaluate( () => {
		window.moved = [];
		document.addEventListener(
			'animationstart',
			( event ) => {
				const animation = event.target
					.getAnimations()
					.find(
						( { animationName } ) =>
							animationName === event.animationName
					);
				if (
					animation?.effect
						.getKeyframes()
						.some(
							( frame ) =>
								( frame.transform &&
									frame.transform !== 'none' ) ||
								frame.translate
						)
				) {
					window.moved.push( event.animationName );
				}
			},
			true
		);
	} );

test.describe( 'Native dialog', () => {
	// WordPress's Playwright config turns motion off. Visitors mostly have it on,
	// and closing waits for an animation, so that's what these run with.
	test.use( {
		contextOptions: {
			reducedMotion: 'no-preference',
			strictSelectors: true,
		},
	} );

	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		const created = await requestUtils.createPage( {
			title: 'Browsers test',
			status: 'publish',
			content: `<!-- wp:paragraph --><p><a href="#modal-browser">Open the modal</a></p><!-- /wp:paragraph -->\n${ filler }`,
		} );
		pageUrl = new URL( created.link ).pathname;
	} );

	test.beforeEach( async ( { page } ) => {
		await freshStorage( page );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllPages();
	} );

	for ( const [ name, attributes ] of Object.entries( OVERLAYS ) ) {
		test( `${ name }: opens above the page, keeps focus, and closes back to the link`, async ( {
			page,
			requestUtils,
		} ) => {
			await createModal( requestUtils, {
				slug: 'browser',
				attributes,
			} );
			await visit( page );

			const link = page.getByRole( 'link', { name: 'Open the modal' } );
			const linkBox = await link.boundingBox();
			await link.click();

			const dialog = page.locator( '#modal-browser' );
			await expect( dialog ).toBeVisible();
			expect(
				await dialog.evaluate( ( node ) => node.matches( ':modal' ) ),
				'in the top layer, with the page behind inert'
			).toBe( true );
			await expect( dialog.getByRole( 'heading' ) ).toBeFocused();

			// It fits, and the page didn't gain a sideways scroll.
			const panel = await dialog
				.locator( '.modal-kit__panel' )
				.boundingBox();
			const viewport = page.viewportSize();
			expect( panel.x ).toBeGreaterThanOrEqual( -1 );
			expect( panel.x + panel.width ).toBeLessThanOrEqual(
				viewport.width + 1
			);
			expect(
				await page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						window.innerWidth
				)
			).toBe( true );

			// The link is behind it, out of reach.
			expect(
				await page.evaluate(
					( { x, y } ) =>
						!! document
							.elementFromPoint( x, y )
							?.closest( 'a[href="#modal-browser"]' ),
					{
						x: linkBox.x + linkBox.width / 2,
						y: linkBox.y + linkBox.height / 2,
					}
				)
			).toBe( false );

			// Tabbing never lands on the page behind (the browser's own controls
			// and the body are fine: that's how a dialog lets people out).
			for ( let i = 0; i < 8; i++ ) {
				await page.keyboard.press( 'Tab' );
				expect(
					await page.evaluate( () => {
						const active =
							document.body.ownerDocument.activeElement;
						return (
							active === document.body ||
							!! active?.closest( '#modal-browser' )
						);
					} )
				).toBe( true );
			}

			const close = dialog.getByRole( 'button', { name: 'Close' } );
			const closeBox = await close.boundingBox();
			expect( closeBox.width ).toBeGreaterThanOrEqual( 44 );
			expect( closeBox.height ).toBeGreaterThanOrEqual( 44 );

			await close.click();
			await expect( dialog ).toBeHidden();
			await expect( link ).toBeFocused();
			await expect( page.locator( 'html' ) ).not.toHaveClass(
				/modal-kit-locked/
			);
		} );
	}

	test( 'opening again during the closing animation leaves it open', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'browser' } );
		await visit( page );

		const dialog = page.locator( '#modal-browser' );
		await page.getByRole( 'link', { name: 'Open the modal' } ).click();
		await expect( dialog ).toBeVisible();

		await page.waitForTimeout( 500 );

		// In one task, so that it can't miss the animation.
		const closing = await page.evaluate( () => {
			const modal = document.querySelector( '#modal-browser' );
			modal.querySelector( 'button[aria-label="Close"]' ).click();
			const during = modal.classList.contains( 'is-closing' );
			document.querySelector( 'a[href="#modal-browser"]' ).click();
			return during;
		} );
		expect( closing, 'it really was closing' ).toBe( true );
		await page.waitForTimeout( 800 );

		await expect( dialog ).toBeVisible();
		expect(
			await dialog.evaluate( ( node ) => node.matches( ':modal' ) )
		).toBe( true );
		await expect( page.locator( 'html' ) ).toHaveClass(
			/modal-kit-locked/
		);

		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toBeHidden();
		await expect( page.locator( 'html' ) ).not.toHaveClass(
			/modal-kit-locked/
		);
	} );

	test( 'long content scrolls inside the modal, down to its last button', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'browser',
			inner: `<!-- wp:heading --><h2 class="wp-block-heading">Long read</h2><!-- /wp:heading -->
${ filler }
<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#last">Last button</a></div><!-- /wp:button --></div><!-- /wp:buttons -->`,
		} );
		await visit( page );
		await page.getByRole( 'link', { name: 'Open the modal' } ).click();

		const dialog = page.locator( '#modal-browser' );
		const last = dialog.getByRole( 'link', { name: 'Last button' } );
		await last.scrollIntoViewIfNeeded();
		await expect( last ).toBeInViewport();
		expect( await page.evaluate( () => window.scrollY ) ).toBe( 0 );
		await expect(
			dialog.getByRole( 'button', { name: 'Close' } )
		).toBeVisible();
	} );

	test( 'the page behind doesn’t scroll or jump', async ( {
		page,
		requestUtils,
		isMobile,
	} ) => {
		test.skip( isMobile, 'Phones have no mouse wheel to test with.' );

		await createModal( requestUtils, { slug: 'browser' } );
		await visit( page );

		await page.evaluate( () => window.scrollTo( 0, 300 ) );
		await page.evaluate( () => {
			window.location.hash = 'modal-browser';
		} );

		const dialog = page.locator( '#modal-browser' );
		await expect( dialog ).toBeVisible();
		await expect
			.poll( () => page.evaluate( () => window.scrollY ) )
			.toBe( 300 );

		await page.mouse.move( 5, 300 );
		await page.mouse.wheel( 0, 600 );
		await page.waitForTimeout( 400 );
		expect( await page.evaluate( () => window.scrollY ) ).toBe( 300 );

		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toBeHidden();
		expect( await page.evaluate( () => window.scrollY ) ).toBe( 300 );
	} );

	test( 'with motion on, a drawer slides in and closes', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'browser',
			attributes: OVERLAYS.drawer,
		} );
		await visit( page );
		await watchMovement( page );

		const link = page.getByRole( 'link', { name: 'Open the modal' } );
		await link.click();
		const dialog = page.locator( '#modal-browser' );
		await expect( dialog ).toBeVisible();
		await expect
			.poll( () => page.evaluate( () => window.moved.length ) )
			.toBeGreaterThan( 0 );
		await page.waitForTimeout( 500 );

		// Closing plays an animation, then really closes.
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toHaveClass( /is-closing/ );
		await expect( dialog ).toBeHidden();
		await expect( dialog ).not.toHaveClass( /is-closing/ );
		await expect( link ).toBeFocused();
	} );

	test( 'reduced motion gets a fade only', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'browser',
			attributes: OVERLAYS.drawer,
		} );
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await visit( page );

		await watchMovement( page );

		await page.getByRole( 'link', { name: 'Open the modal' } ).click();
		const dialog = page.locator( '#modal-browser' );
		await expect( dialog ).toBeVisible();
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toBeHidden();

		expect( await page.evaluate( () => window.moved ) ).toEqual( [] );
	} );
} );

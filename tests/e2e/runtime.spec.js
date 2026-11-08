/**
 * Front-end runtime (plan §3.2, §5): links, every automatic trigger,
 * closing, focus, scroll lock and the no-JS :target fallback.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { devices } = require( '@playwright/test' );
const {
	createModal,
	deleteAllModals,
	freshStorage,
} = require( './utils/modals' );

const filler = Array.from(
	{ length: 40 },
	( _, i ) =>
		`<!-- wp:paragraph --><p>Paragraph ${
			i + 1
		}. Notebooks, pens and essays for people who still think on paper.</p><!-- /wp:paragraph -->`
).join( '\n' );

const PAGE_CONTENT = `<!-- wp:paragraph --><p><a href="#modal-runtime">Open the modal</a> · <a href="?modal=runtime">Open with a query link</a></p><!-- /wp:paragraph -->
${ filler }
<!-- wp:group {"anchor":"workshops","layout":{"type":"constrained"}} -->
<div class="wp-block-group" id="workshops"><!-- wp:paragraph --><p>Workshops</p><!-- /wp:paragraph --></div>
<!-- /wp:group -->
${ filler }`;

let pageUrl;

/**
 * Opens the test page.
 *
 * @param {Object} page   Playwright page.
 * @param {string} [tail] Query or hash to append.
 */
async function visit( page, tail = '' ) {
	await page.goto( pageUrl + tail );
	await page.waitForFunction( () =>
		document.documentElement.classList.contains( 'modal-kit-js' )
	);
}

/**
 * Scrolls the page: with the wheel, or by script where a phone has no wheel to
 * emulate (tests/browsers).
 *
 * @param {Object} page Playwright page.
 * @param {number} by   Pixels.
 */
const scrollPage = ( page, by ) =>
	page.mouse
		.wheel( 0, by )
		.catch( () => page.evaluate( ( y ) => window.scrollBy( 0, y ), by ) );

test.describe( 'Runtime', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		const created = await requestUtils.createPage( {
			title: 'Runtime test',
			status: 'publish',
			content: PAGE_CONTENT,
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

	test( 'a link opens the modal, focuses its heading, Esc closes and focus returns', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'runtime' } );
		await visit( page );

		const dialog = page.locator( '#modal-runtime' );
		const link = page.getByRole( 'link', { name: 'Open the modal' } );

		await expect( dialog ).toBeHidden();
		await link.click();
		await expect( dialog ).toBeVisible();
		await expect(
			dialog.getByRole( 'heading', { name: /20% off/ } )
		).toBeFocused();
		await expect( page.locator( 'html' ) ).toHaveClass(
			/modal-kit-locked/
		);

		// The page behind is inert (native modal dialog).
		expect(
			await page.evaluate( () =>
				document.querySelector( '#modal-runtime' ).matches( ':modal' )
			)
		).toBe( true );

		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toBeHidden();
		await expect( link ).toBeFocused();
		await expect( page.locator( 'html' ) ).not.toHaveClass(
			/modal-kit-locked/
		);
		expect( page.url() ).not.toContain( '#modal-runtime' );
	} );

	test( 'the close button and a click outside close it', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'runtime' } );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await page.getByRole( 'link', { name: 'Open the modal' } ).click();
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toBeHidden();

		await page
			.getByRole( 'link', { name: 'Open with a query link' } )
			.click();
		await expect( dialog ).toBeVisible();
		await page.mouse.click( 5, 400 );
		await expect( dialog ).toBeHidden();
	} );

	test( 'Esc and click outside can be turned off', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			attributes: {
				closeOptions: {
					button: true,
					esc: false,
					outside: false,
					visibleLabel: false,
				},
			},
		} );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await page.getByRole( 'link', { name: 'Open the modal' } ).click();
		await page.keyboard.press( 'Escape' );
		await page.mouse.click( 5, 400 );
		await page.waitForTimeout( 400 );
		await expect( dialog ).toBeVisible();
	} );

	test( 'arriving with the hash or ?modal= opens it', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'runtime' } );
		const dialog = page.locator( '#modal-runtime' );

		await visit( page, '#modal-runtime' );
		await expect( dialog ).toBeVisible();

		await visit( page, '?modal=runtime' );
		await expect( dialog ).toBeVisible();
	} );

	test( 'page load + delay', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			meta: { triggers: [ { type: 'load', delay: 1 } ] },
		} );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await expect( dialog ).toBeHidden();
		await expect( dialog ).toBeVisible( { timeout: 3000 } );
	} );

	test( 'scroll depth', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			meta: { triggers: [ { type: 'scroll', percent: 50 } ] },
		} );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await scrollPage( page, 300 );
		await page.waitForTimeout( 300 );
		await expect( dialog ).toBeHidden();

		await page.evaluate( () =>
			window.scrollTo( 0, document.documentElement.scrollHeight * 0.7 )
		);
		await expect( dialog ).toBeVisible();
	} );

	test( 'leaving the page on desktop', async ( {
		page,
		requestUtils,
		isMobile,
	} ) => {
		test.skip( isMobile, 'Phones have no pointer to leave with.' );

		await createModal( requestUtils, {
			slug: 'runtime',
			meta: { triggers: [ { type: 'exit' } ] },
		} );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await page.mouse.move( 600, 300 );
		await expect( dialog ).toBeHidden();

		// The trigger's script loads after the page is ready, and an event
		// sent before that is lost, so keep sending it.
		await expect( async () => {
			await page.evaluate( () =>
				document.documentElement.dispatchEvent(
					new window.MouseEvent( 'mouseout', {
						bubbles: true,
						clientX: 600,
						clientY: -2,
						relatedTarget: null,
					} )
				)
			);
			await expect( dialog ).toBeVisible( { timeout: 500 } );
		} ).toPass();
	} );

	test( 'leaving the page on touch falls back to a fast scroll up', async ( {
		browser,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			meta: { triggers: [ { type: 'exit', touch: 'scroll-up' } ] },
		} );
		const context = await browser.newContext( {
			...devices[ 'Pixel 7' ],
			baseURL: process.env.WP_BASE_URL,
		} );
		const page = await context.newPage();
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await page.evaluate( () => window.scrollTo( 0, 3000 ) );
		await page.waitForTimeout( 500 );
		await expect( dialog ).toBeHidden();

		await page.evaluate( () => window.scrollTo( 0, 1500 ) );
		await expect( dialog ).toBeVisible();
		await context.close();
	} );

	test( 'time on site counts across pages', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			meta: { triggers: [ { type: 'time', delay: 3 } ] },
		} );
		await visit( page );
		await page.evaluate( () => window.localStorage.clear() );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await page.waitForTimeout( 1800 );
		await expect( dialog ).toBeHidden();

		// A new page view continues the same visit.
		await visit( page );
		await expect( dialog ).toBeVisible( { timeout: 2500 } );
	} );

	test( 'inactivity', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			meta: { triggers: [ { type: 'inactivity', delay: 2 } ] },
		} );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		// Activity keeps resetting the timer.
		for ( let i = 0; i < 3; i++ ) {
			await page.waitForTimeout( 1000 );
			await scrollPage( page, 50 );
		}
		await expect( dialog ).toBeHidden();

		await expect( dialog ).toBeVisible( { timeout: 3500 } );
	} );

	test( 'URL hash or query', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			meta: {
				triggers: [ { type: 'url', value: 'utm_campaign=autumn' } ],
			},
		} );
		const dialog = page.locator( '#modal-runtime' );

		await visit( page, '?utm_campaign=spring' );
		await page.waitForTimeout( 500 );
		await expect( dialog ).toBeHidden();

		await visit( page, '?utm_campaign=autumn' );
		await expect( dialog ).toBeVisible();
	} );

	test( 'element in view', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			meta: { triggers: [ { type: 'element', anchor: 'workshops' } ] },
		} );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await page.waitForTimeout( 500 );
		await expect( dialog ).toBeHidden();

		await page.locator( '#workshops' ).scrollIntoViewIfNeeded();
		await expect( dialog ).toBeVisible();
	} );

	test( 'corner and bar leave the page usable', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			attributes: { modalLayout: 'corner' },
			meta: { triggers: [ { type: 'load', delay: 0 } ] },
		} );
		await visit( page );
		const dialog = page.locator( '#modal-runtime' );

		await expect( dialog ).toBeVisible();
		await expect( page.locator( 'html' ) ).not.toHaveClass(
			/modal-kit-locked/
		);
		expect(
			await dialog.evaluate( ( el ) => el.matches( ':modal' ) )
		).toBe( false );

		// Opened on its own, it doesn't take focus from the page (#111).
		expect(
			await dialog.evaluate( ( el ) =>
				el.contains( el.ownerDocument.activeElement )
			)
		).toBe( false );

		// The page behind still takes clicks and scrolls.
		await scrollPage( page, 400 );
		await expect
			.poll( () => page.evaluate( () => window.scrollY ) )
			.toBeGreaterThan( 100 );

		// A link is a request: it focuses the heading, and focus returns.
		await dialog.evaluate( ( el ) => el.close() );
		await expect( dialog ).toBeHidden();

		const link = page.getByRole( 'link', { name: 'Open the modal' } );
		await link.click();
		await expect(
			dialog.getByRole( 'heading', { name: /20% off/ } )
		).toBeFocused();
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( link ).toBeFocused();
	} );

	test( 'inline modals render in the content flow', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'runtime',
			attributes: { modalLayout: 'inline' },
			meta: { triggers: [ { type: 'load', delay: 0 } ] },
		} );
		await visit( page );

		const dialog = page.locator( 'main #modal-runtime' );
		await expect( dialog ).toBeVisible();
	} );

	test( 'without JavaScript, the link shows the modal as an in-page panel', async ( {
		browser,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'runtime' } );
		const context = await browser.newContext( {
			javaScriptEnabled: false,
			baseURL: process.env.WP_BASE_URL,
		} );
		const page = await context.newPage();
		const dialog = page.locator( '#modal-runtime' );

		await page.goto( pageUrl );
		await expect( dialog ).toBeHidden();

		await page.goto( pageUrl + '#modal-runtime' );
		await expect( dialog ).toBeVisible();
		await expect(
			dialog.getByRole( 'heading', { name: /20% off/ } )
		).toBeVisible();
		await context.close();
	} );
} );

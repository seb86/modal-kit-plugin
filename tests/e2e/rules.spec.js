/**
 * Rules: page targeting on the server, frequency
 * across reloads, schedule, devices, page views and the site-wide limits
 * from 5a in the browser.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	freshStorage,
	setSettings,
} = require( './utils/modals' );

const LOAD = [ { type: 'load', delay: 0 } ];

const DEFAULT_RULES = {
	showOn: { mode: 'all', include: [], exclude: [], postTypes: [] },
	frequency: { mode: 'days', days: 7, stopAfterCta: true },
	devices: [ 'desktop', 'tablet', 'mobile' ],
	schedule: { start: '', end: '' },
	visitors: { hideLoggedIn: false, minPageViews: 0 },
};

/**
 * Rules with some parts replaced.
 *
 * @param {Object} parts Top-level rule parts to replace.
 * @return {Object} Rules.
 */
const rules = ( parts ) => ( { ...DEFAULT_RULES, ...parts } );

const pages = {};

/**
 * Opens a test page and waits for the runtime.
 *
 * @param {Object} page   Playwright page.
 * @param {string} name   Page key (a, b).
 * @param {string} [tail] Query or hash.
 */
async function visit( page, name = 'a', tail = '' ) {
	await page.goto( pages[ name ] + tail );
	await page.waitForFunction( () =>
		document.documentElement.classList.contains( 'modal-kit-js' )
	);
	await page.waitForTimeout( 300 );
}

test.describe( 'Rules', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		const a = await requestUtils.createPage( {
			title: 'Rules A',
			status: 'publish',
			content: '<!-- wp:paragraph --><p>Page A</p><!-- /wp:paragraph -->',
		} );
		const b = await requestUtils.createPage( {
			title: 'Rules B',
			status: 'publish',
			content:
				'<!-- wp:paragraph --><p><a href="#modal-rules">Open the modal</a></p><!-- /wp:paragraph -->',
		} );
		pages.a = new URL( a.link ).pathname;
		pages.b = new URL( b.link ).pathname;
		pages.aId = a.id;
	} );

	test.beforeEach( async ( { page, requestUtils } ) => {
		await freshStorage( page );
		await setSettings( requestUtils, 'general', {
			autoOpenLimit: 1,
			cooldown: 0,
		} );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await setSettings( requestUtils, 'general', {} );
		await requestUtils.deleteAllPages();
	} );

	test( 'every N days: shown once, then not again across reloads', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: { triggers: LOAD },
		} );
		const dialog = page.locator( '#modal-rules' );

		await visit( page );
		await expect( dialog ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toBeHidden();

		await visit( page );
		await expect( dialog ).toBeHidden();
		await visit( page );
		await expect( dialog ).toBeHidden();

		// Eight days later it shows again.
		await page.evaluate( () => {
			const seen = JSON.parse( localStorage.getItem( 'modal-kit:seen' ) );
			seen.rules.at -= 8 * 24 * 60 * 60 * 1000;
			localStorage.setItem( 'modal-kit:seen', JSON.stringify( seen ) );
		} );
		await visit( page );
		await expect( dialog ).toBeVisible();
	} );

	test( 'once per session: again on the next visit', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					frequency: {
						mode: 'session',
						days: 7,
						stopAfterCta: false,
					},
				} ),
			},
		} );
		const dialog = page.locator( '#modal-rules' );

		await visit( page );
		await expect( dialog ).toBeVisible();
		await visit( page );
		await expect( dialog ).toBeHidden();

		// 31 minutes without a page view starts a new visit.
		await page.evaluate( () => {
			const record = JSON.parse(
				localStorage.getItem( 'modal-kit:visit' )
			);
			record.last -= 31 * 60 * 1000;
			localStorage.setItem( 'modal-kit:visit', JSON.stringify( record ) );
		} );
		await visit( page );
		await expect( dialog ).toBeVisible();
	} );

	test( 'always, until the visitor clicks a button', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					frequency: { mode: 'always', days: 7, stopAfterCta: true },
				} ),
			},
		} );
		const dialog = page.locator( '#modal-rules' );

		await visit( page );
		await expect( dialog ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await visit( page );
		await expect( dialog ).toBeVisible();

		await dialog.getByText( 'Shop the sale' ).click();
		await visit( page );
		await expect( dialog ).toBeHidden();
	} );

	test( 'at most N times in total: links still open it and are not counted', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					frequency: {
						mode: 'always',
						days: 7,
						stopAfterCta: false,
						maxShows: 2,
					},
				} ),
			},
		} );
		const dialog = page.locator( '#modal-rules' );
		const shows = () =>
			page.evaluate(
				() =>
					JSON.parse( localStorage.getItem( 'modal-kit:seen' ) ).rules
						.shows
			);

		for ( let time = 1; time <= 2; time++ ) {
			await visit( page );
			await expect( dialog ).toBeVisible();
			await page.keyboard.press( 'Escape' );
			await expect( dialog ).toBeHidden();
		}
		expect( await shows() ).toBe( 2 );

		await visit( page );
		await expect( dialog ).toBeHidden();

		// A link always opens it, and doesn't use up the cap.
		await visit( page, 'b' );
		await page.getByRole( 'link', { name: 'Open the modal' } ).click();
		await expect( dialog ).toBeVisible();
		expect( await shows() ).toBe( 2 );
	} );

	test( 'browsers: only the ones picked, read in the browser', async ( {
		browser,
		baseURL,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					browsers: { mode: 'only', list: [ 'firefox' ] },
				} ),
			},
		} );

		const open = async ( userAgent ) => {
			const context = await browser.newContext( { baseURL, userAgent } );
			const page = await context.newPage();
			await visit( page );
			const visible = await page.locator( '#modal-rules' ).isVisible();
			await context.close();

			return visible;
		};

		expect(
			await open(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
			)
		).toBe( false );
		expect(
			await open(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0'
			)
		).toBe( true );
	} );

	test( 'editing the modal resets what the visitor has seen', async ( {
		page,
		requestUtils,
	} ) => {
		const post = await createModal( requestUtils, {
			slug: 'rules',
			meta: { triggers: LOAD },
		} );
		const dialog = page.locator( '#modal-rules' );

		await visit( page );
		await expect( dialog ).toBeVisible();
		await visit( page );
		await expect( dialog ).toBeHidden();

		await requestUtils.rest( {
			path: `/wp/v2/mk_modal/${ post.id }`,
			method: 'POST',
			data: {
				content: post.content.raw.replace(
					'Use code AUTUMN20',
					'Use code WINTER25'
				),
			},
		} );
		await visit( page );
		await expect( dialog ).toBeVisible();
	} );

	test( 'remembering dismissals can be turned off', async ( {
		page,
		requestUtils,
	} ) => {
		await setSettings( requestUtils, 'general', {
			cooldown: 0,
			remember: 'none',
		} );
		await createModal( requestUtils, {
			slug: 'rules',
			meta: { triggers: LOAD },
		} );
		const dialog = page.locator( '#modal-rules' );

		await visit( page );
		await expect( dialog ).toBeVisible();
		await visit( page );
		await expect( dialog ).toBeVisible();
		expect(
			await page.evaluate( () =>
				localStorage.getItem( 'modal-kit:seen' )
			)
		).toBe( null );
	} );

	test( 'schedule', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					schedule: { start: '', end: '2020-01-01T00:00:00Z' },
				} ),
			},
		} );
		await createModal( requestUtils, {
			slug: 'rules-later',
			meta: {
				triggers: LOAD,
				rules: rules( {
					schedule: { start: '2099-01-01T00:00:00Z', end: '' },
				} ),
			},
		} );

		await visit( page );
		await expect( page.locator( '#modal-rules' ) ).toBeHidden();
		await expect( page.locator( '#modal-rules-later' ) ).toBeHidden();
	} );

	test( 'devices', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( { devices: [ 'mobile' ] } ),
			},
		} );
		const dialog = page.locator( '#modal-rules' );

		await page.setViewportSize( { width: 1280, height: 800 } );
		await visit( page );
		await expect( dialog ).toBeHidden();

		await page.setViewportSize( { width: 375, height: 740 } );
		await visit( page );
		await expect( dialog ).toBeVisible();
	} );

	test( 'minimum page views', async ( { page, requestUtils } ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					visitors: { hideLoggedIn: false, minPageViews: 2 },
				} ),
			},
		} );
		const dialog = page.locator( '#modal-rules' );

		await visit( page );
		await expect( dialog ).toBeHidden();
		await visit( page, 'b' );
		await expect( dialog ).toBeVisible();
	} );

	test( 'site-wide auto-open limit and cool-down', async ( {
		page,
		requestUtils,
	} ) => {
		const corner = { modalLayout: 'corner' };

		await createModal( requestUtils, {
			slug: 'rules',
			attributes: corner,
			meta: { triggers: LOAD },
		} );
		await createModal( requestUtils, {
			slug: 'rules-two',
			attributes: corner,
			meta: { triggers: LOAD },
		} );
		const open = page.locator( 'dialog.modal-kit[open]' );

		await visit( page );
		await expect( open ).toHaveCount( 1 );

		await setSettings( requestUtils, 'general', {
			autoOpenLimit: 0,
			cooldown: 0,
		} );
		await page.evaluate( () => localStorage.clear() );
		await visit( page );
		await expect( open ).toHaveCount( 2 );

		await setSettings( requestUtils, 'general', {
			autoOpenLimit: 0,
			cooldown: 60,
		} );
		await page.evaluate( () => localStorage.clear() );
		await visit( page );
		await expect( open ).toHaveCount( 1 );
	} );

	test( 'page targeting decides where a modal is printed', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					showOn: {
						mode: 'include',
						include: [ pages.a ],
						exclude: [],
						postTypes: [],
					},
				} ),
			},
		} );
		await createModal( requestUtils, {
			slug: 'rules-excluded',
			meta: {
				rules: rules( {
					showOn: {
						mode: 'exclude',
						include: [],
						exclude: [ pages.a ],
						postTypes: [],
					},
				} ),
			},
		} );

		await visit( page, 'a' );
		await expect( page.locator( '#modal-rules' ) ).toBeVisible();
		await expect( page.locator( '#modal-rules-excluded' ) ).toHaveCount(
			0
		);

		await page.evaluate( () => localStorage.clear() );
		await visit( page, 'b' );
		// Page B links to it, so it is printed and the link works, but its
		// automatic trigger doesn't run where targeting doesn't match.
		await expect( page.locator( '#modal-rules' ) ).toHaveCount( 1 );
		await expect( page.locator( '#modal-rules' ) ).toBeHidden();
		await expect( page.locator( '#modal-rules-excluded' ) ).toHaveCount(
			1
		);

		await page.getByRole( 'link', { name: 'Open the modal' } ).click();
		await expect( page.locator( '#modal-rules' ) ).toBeVisible();
	} );

	test( 'a page picked in the editor is matched by its ID', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					showOn: {
						mode: 'include',
						include: [ `post:${ pages.aId }` ],
						exclude: [],
						postTypes: [],
					},
				} ),
			},
		} );

		await visit( page, 'a' );
		await expect( page.locator( '#modal-rules' ) ).toBeVisible();

		await page.evaluate( () => localStorage.clear() );
		await visit( page, 'b' );
		await expect( page.locator( '#modal-rules' ) ).toBeHidden();
	} );

	test( 'hidden for logged-in visitors, except in preview', async ( {
		browser,
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'rules',
			meta: {
				triggers: LOAD,
				rules: rules( {
					frequency: { mode: 'always', days: 7, stopAfterCta: false },
					visitors: { hideLoggedIn: true, minPageViews: 0 },
				} ),
			},
		} );
		const dialog = page.locator( '#modal-rules' );

		// Logged in (the test user): not on the page at all, so neither an
		// automatic trigger nor a direct link opens it. (Nothing to print
		// means no Modal Kit script either, so plain page loads.)
		for ( const tail of [ '', '?modal=rules', '#modal-rules' ] ) {
			await page.goto( pages.a + tail );
			await expect( page.locator( 'h1, h2' ).first() ).toBeVisible();
			await expect( dialog ).toHaveCount( 0 );
		}

		// ?modal=preview bypasses the rules for editors.
		await visit( page, 'a', '?modal=preview' );
		await expect( dialog ).toBeVisible();

		// A logged-out visitor sees it.
		const context = await browser.newContext( {
			baseURL: process.env.WP_BASE_URL,
			storageState: { cookies: [], origins: [] },
		} );
		const guest = await context.newPage();
		await guest.goto( pages.a );
		await expect( guest.locator( '#modal-rules' ) ).toBeVisible();

		// …and a direct link opens it for them.
		await guest.goto( pages.a + '?modal=rules' );
		await expect( guest.locator( '#modal-rules' ) ).toBeVisible();
		await context.close();
	} );
} );

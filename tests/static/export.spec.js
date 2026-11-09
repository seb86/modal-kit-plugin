/**
 * Modals on a Simply Static export: no PHP, no REST, no admin-ajax.
 * Links, triggers (lazily imported), page targeting, frequency and the no-JS
 * fallback must all keep working.
 */
const { test, expect } = require( '@playwright/test' );

const paths = JSON.parse( process.env.STATIC_PATHS ?? '{}' );

test.describe( 'Static export', () => {
	let wordpressRequests = [];

	test.beforeEach( async ( { page } ) => {
		// Any request back to WordPress is a failure on a static site.
		wordpressRequests = [];
		page.on( 'request', ( request ) => {
			if (
				/wp-admin|admin-ajax|wp-json|\?rest_route=/.test(
					request.url()
				)
			) {
				wordpressRequests.push( request.url() );
			}
		} );
	} );

	test.afterEach( () => {
		expect( wordpressRequests ).toEqual( [] );
	} );

	test( 'the script modules and import map are exported', async ( {
		page,
	} ) => {
		const failed = [];
		page.on( 'response', ( response ) => {
			if ( response.status() >= 400 ) {
				failed.push( `${ response.status() } ${ response.url() }` );
			}
		} );

		await page.goto( paths[ 'static-home' ] );
		await expect( page.locator( 'script[type="importmap"]' ) ).toHaveCount(
			1
		);
		const importMap = JSON.parse(
			await page.locator( 'script[type="importmap"]' ).textContent()
		);
		expect( Object.keys( importMap.imports ) ).toContain(
			'@wordpress/interactivity'
		);
		expect(
			Object.values( importMap.imports ).every(
				( url ) => ! url.includes( 'localhost:8082' )
			)
		).toBe( true );

		await page.waitForFunction( () =>
			document.documentElement.classList.contains( 'modal-kit-js' )
		);
		expect( failed ).toEqual( [] );
	} );

	test( 'a link opens the modal, and the Close action closes it', async ( {
		page,
	} ) => {
		await page.goto( paths[ 'static-home' ] );
		await page.waitForFunction( () =>
			document.documentElement.classList.contains( 'modal-kit-js' )
		);

		const dialog = page.locator( '#modal-static-link' );
		await page.getByRole( 'link', { name: 'Open the modal' } ).click();
		await expect( dialog ).toBeVisible();
		await expect(
			dialog.getByRole( 'heading', { name: 'Static sale' } )
		).toBeFocused();

		await dialog.getByRole( 'button', { name: 'No thanks' } ).click();
		await expect( dialog ).toBeHidden();
	} );

	test( 'lazily imported triggers load from the export', async ( {
		page,
	} ) => {
		const chunk = page.waitForResponse( /runtime\/trigger-scroll\.js/ );

		await page.goto( paths[ 'static-home' ] );
		expect( ( await chunk ).status() ).toBe( 200 );

		await page.evaluate( () =>
			window.scrollTo( 0, document.documentElement.scrollHeight * 0.6 )
		);
		await expect( page.locator( '#modal-static-scroll' ) ).toBeVisible();
	} );

	test( 'a fixed style loads its bundled fonts from the export', async ( {
		page,
	} ) => {
		const fonts = [];
		page.on( 'response', ( response ) => {
			if ( /\.woff2(\?|$)/.test( response.url() ) ) {
				fonts.push( response );
			}
		} );

		await page.goto( paths[ 'static-styled' ] );
		const dialog = page.locator( '#modal-static-styled' );
		await expect( dialog ).toBeVisible();
		await expect( dialog ).toHaveClass( /mk-style-harbor/ );
		await page.evaluate( () => document.fonts.ready );

		expect(
			await page.evaluate( () =>
				[ ...document.fonts ]
					.filter( ( font ) => font.status === 'loaded' )
					.map( ( font ) => font.family.replace( /"/g, '' ) )
			)
		).toEqual(
			expect.arrayContaining( [ 'Instrument Serif', 'Instrument Sans' ] )
		);
		expect( fonts.length ).toBeGreaterThan( 0 );
		for ( const response of fonts ) {
			expect( response.status() ).toBe( 200 );
			expect( response.url() ).not.toContain( 'localhost:8082' );
			expect( response.url() ).not.toContain( 'fonts.g' );
		}
	} );

	test( 'page targeting was resolved at export time', async ( { page } ) => {
		await page.goto( paths[ 'static-home' ] );
		await expect( page.locator( '#modal-static-shop' ) ).toHaveCount( 0 );

		await page.goto( paths[ 'static-shop' ] );
		await expect( page.locator( '#modal-static-shop' ) ).toBeVisible();
	} );

	test( 'frequency is remembered in localStorage across reloads', async ( {
		page,
	} ) => {
		await page.goto( paths[ 'static-shop' ] );
		const dialog = page.locator( '#modal-static-shop' );
		await expect( dialog ).toBeVisible();
		await page.keyboard.press( 'Escape' );

		await page.reload();
		await page.waitForTimeout( 800 );
		await expect( dialog ).toBeHidden();
		expect(
			await page.evaluate( () =>
				Object.keys( window.localStorage ).filter( ( key ) =>
					key.startsWith( 'modal-kit:' )
				)
			)
		).toEqual( expect.arrayContaining( [ 'modal-kit:seen' ] ) );

		const cookies = await page.context().cookies();
		expect( cookies ).toEqual( [] );
	} );

	test( 'without JavaScript, the link still shows the modal', async ( {
		browser,
	} ) => {
		const context = await browser.newContext( {
			baseURL: process.env.STATIC_BASE_URL,
			javaScriptEnabled: false,
		} );
		const page = await context.newPage();

		await page.goto( paths[ 'static-home' ] + '#modal-static-link' );
		await expect(
			page.locator( '#modal-static-link' ).getByRole( 'heading', {
				name: 'Static sale',
			} )
		).toBeVisible();
		await context.close();
	} );
} );

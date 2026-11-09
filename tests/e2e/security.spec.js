/**
 * What the security review found, replayed in a real browser. The posts are
 * created as an administrator, whose content kses leaves alone, so these
 * prove the runtime itself refuses them.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { createModal, deleteAllModals } = require( './utils/modals' );

const BUTTON =
	'<!-- wp:button {"modalKitVideoLightbox":true} --><div class="wp-block-button"><a class="wp-block-button__link" href="https://youtu.be/x">Watch</a></div><!-- /wp:button -->';

test.describe( 'Security', () => {
	const posts = [];

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );

		for ( const id of posts ) {
			await requestUtils.rest( {
				path: `/wp/v2/posts/${ id }`,
				method: 'DELETE',
				params: { force: true },
			} );
		}
	} );

	test( 'a script address in a video link does nothing', async ( {
		page,
		requestUtils,
	} ) => {
		const post = await requestUtils.rest( {
			path: '/wp/v2/posts',
			method: 'POST',
			data: {
				title: 'Video address',
				status: 'publish',
				content: `${ BUTTON }<!-- wp:html --><a id="bad" href="#" data-wp-interactive="modal-kit" data-wp-on--click="modal-kit::actions.playVideo" data-modal-kit-video="javascript:alert(1)">Claim</a><!-- /wp:html -->`,
			},
		} );
		posts.push( post.id );

		const dialogs = [];
		page.on( 'dialog', async ( dialog ) => {
			dialogs.push( dialog.message() );
			await dialog.dismiss();
		} );

		await page.goto( post.link, { waitUntil: 'networkidle' } );
		const url = page.url();

		await page.locator( '#bad' ).click();
		await page.waitForTimeout( 1000 );

		expect( dialogs ).toEqual( [] );
		expect( page.url() ).toBe( url );
	} );

	test( 'visitors can not read modals over REST', async ( {
		playwright,
		requestUtils,
		baseURL,
	} ) => {
		const modal = await createModal( requestUtils, {
			slug: 'rest-private',
		} );
		const visitor = await playwright.request.newContext( {
			baseURL,
			storageState: { cookies: [], origins: [] },
		} );

		for ( const route of [
			'/wp-json/wp/v2/mk_modal',
			`/wp-json/wp/v2/mk_modal/${ modal.id }`,
		] ) {
			const response = await visitor.get( route );
			expect( response.status() ).toBe( 401 );
		}

		await visitor.dispose();
	} );

	test( 'a malformed layout does not take the site down', async ( {
		page,
		requestUtils,
	} ) => {
		await requestUtils.rest( {
			path: '/wp/v2/mk_modal',
			method: 'POST',
			data: {
				title: 'Malformed',
				slug: 'malformed',
				status: 'publish',
				content:
					'<!-- wp:modal-kit/modal {"modalLayout":[]} --><div class="wp-block-modal-kit-modal"></div><!-- /wp:modal-kit/modal -->',
			},
		} );

		const response = await page.goto( '/' );
		expect( response.status() ).toBe( 200 );
	} );
} );

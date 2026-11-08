/**
 * "Site preview" in the editor: the real homepage behind the modal, with no
 * modals, no admin bar and no scripts. Visitors can't use the argument.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	newBlankModal,
} = require( './utils/modals' );

test.describe( 'Homepage behind the modal', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		// A modal that opens on every page, so "no modals" means something.
		await createModal( requestUtils, {
			slug: 'everywhere',
			meta: { triggers: [ { type: 'load', delay: 0 } ] },
		} );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test( 'loads without modals, admin bar or scripts', async ( {
		admin,
		editor,
		page,
	} ) => {
		await page.addInitScript( () =>
			window.localStorage.setItem( 'modal-kit:editor-backdrop', 'site' )
		);
		await newBlankModal( admin, page );

		const stage = editor.canvas.locator( '.modal-kit.is-editor-preview' );
		await expect( stage ).toHaveClass( /has-homepage/, { timeout: 20000 } );

		const frame = editor.canvas.locator(
			'iframe.modal-kit-editor-homepage'
		);
		await expect( frame ).toHaveAttribute( 'sandbox', 'allow-same-origin' );
		await expect( frame ).toHaveAttribute( 'src', /modal_kit_backdrop=1/ );

		const homepage = editor.canvas.frameLocator(
			'iframe.modal-kit-editor-homepage'
		);
		await expect( homepage.locator( 'body' ) ).toBeVisible();
		await expect( homepage.locator( 'dialog.modal-kit' ) ).toHaveCount( 0 );
		await expect( homepage.locator( '#wpadminbar' ) ).toHaveCount( 0 );

		// Plain drops the homepage; back to Site preview brings it back.
		await page.evaluate( () => {
			const { select, dispatch } = window.wp.data;
			const [ modal ] = select( 'core/block-editor' ).getBlockOrder();
			dispatch( 'core/block-editor' ).selectBlock( modal );
		} );
		await editor.showBlockToolbar();
		const toolbar = page.getByRole( 'toolbar', { name: 'Block tools' } );
		await toolbar.getByRole( 'button', { name: 'Plain' } ).click();
		await expect( frame ).toHaveCount( 0 );
		await toolbar.getByRole( 'button', { name: 'Site preview' } ).click();
		await expect( stage ).toHaveClass( /has-homepage/, { timeout: 20000 } );
	} );

	test( 'the argument does nothing for visitors', async ( { browser } ) => {
		const visitor = await browser.newContext( {
			storageState: { cookies: [], origins: [] },
		} );
		const page = await visitor.newPage();

		await page.goto( '/?modal_kit_backdrop=1&_wpnonce=anything' );
		await expect( page.locator( 'dialog.modal-kit' ) ).toHaveCount( 1 );

		await visitor.close();
	} );
} );

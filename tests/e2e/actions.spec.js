/**
 * Button actions (mockups 2b, 4a) and modals in the link popover (1g).
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	freshStorage,
	newBlankModal,
	resetDismissals,
} = require( './utils/modals' );

const BUTTONS = `<!-- wp:heading -->
<h2 class="wp-block-heading">Autumn sale</h2>
<!-- /wp:heading -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"modalKitAction":"copy","modalKitCopyText":"AUTUMN20"} -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Copy</a></div>
<!-- /wp:button -->

<!-- wp:button {"modalKitAction":"close","className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button">No thanks</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;

test.describe( 'Button actions', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await resetDismissals( requestUtils );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		await resetDismissals( requestUtils );
	} );

	test( 'the Action panel sets the action without changing the saved markup', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page, { title: 'Actions' } );

		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await canvas.locator( '.modal-kit__panel p' ).first().click();
		await page.keyboard.type( '/buttons' );
		await page.keyboard.press( 'Enter' );
		await page.keyboard.type( 'No thanks' );

		await editor.openDocumentSettingsSidebar();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
		await sidebar.getByRole( 'tab', { name: 'Block' } ).click();
		const panel = sidebar.locator( '.modal-kit-action-panel' );

		await expect(
			panel.getByRole( 'radio', { name: 'Open link' } )
		).toBeChecked();
		await panel.getByRole( 'radio', { name: 'Close modal' } ).check();

		// Pro actions are listings with an explainer.
		await panel
			.getByRole( 'button', { name: /Next \/ previous step/ } )
			.click();
		await expect( page.getByText( 'Multi-step modals' ) ).toBeVisible();
		await page.getByRole( 'button', { name: 'Not now' } ).click();
		await expect(
			panel.getByRole( 'button', { name: /Next \/ previous step/ } )
		).toBeHidden();

		const content = await editor.getEditedPostContent();
		expect( content ).toContain( '"modalKitAction":"close"' );
		expect( content ).toContain(
			'<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">No thanks</a></div>'
		);
	} );

	test( 'close and copy work on the front end', async ( {
		browser,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'actions', inner: BUTTONS } );

		const context = await browser.newContext( {
			baseURL: process.env.WP_BASE_URL,
			permissions: [ 'clipboard-read', 'clipboard-write' ],
		} );
		const page = await context.newPage();
		await freshStorage( page );
		await page.goto( '/?modal=actions' );

		const dialog = page.locator( '#modal-actions' );
		await expect( dialog ).toBeVisible();

		// Keyboard: the close button is focusable and works with Enter, and
		// closing is not a call to action.
		const close = dialog.getByRole( 'button', { name: 'No thanks' } );
		await close.focus();
		await page.keyboard.press( 'Enter' );
		await expect( dialog ).toBeHidden();
		const cta = () =>
			page.evaluate(
				() =>
					JSON.parse(
						window.localStorage.getItem( 'modal-kit:seen' )
					)?.actions?.cta
			);
		expect( await cta() ).toBeFalsy();

		await page.goto( '/?modal=actions' );
		await expect( dialog ).toBeVisible();

		const copy = dialog.getByRole( 'button', { name: 'Copy' } );
		await copy.click();
		await expect( dialog.getByText( 'Copied ✓' ) ).toBeVisible();
		expect(
			await page.evaluate( () => window.navigator.clipboard.readText() )
		).toBe( 'AUTUMN20' );
		await expect( page.locator( '.modal-kit-live' ) ).toHaveText(
			'Copied ✓'
		);
		await expect( copy ).toHaveText( 'Copy', { timeout: 4000 } );

		// Taking the code counts as engaging with the modal.
		expect( await cta() ).toBe( true );

		await context.close();
	} );
} );

test.describe( 'Link search', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		await requestUtils.deleteAllPages();
	} );

	test( 'modals appear in the link popover and link to their anchor', async ( {
		admin,
		editor,
		page,
		pageUtils,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'field-guide',
			title: 'Field guide (exit offer)',
		} );
		await admin.createNewPost( { postType: 'page', title: 'Paper issue' } );
		await editor.insertBlock( { name: 'core/paragraph' } );
		await page.keyboard.type( 'Get the free guide' );
		await pageUtils.pressKeys( 'shift+Home' );
		await pageUtils.pressKeys( 'primary+k' );

		await page.keyboard.type( 'Field guide' );
		const option = page.getByRole( 'option', {
			name: /Field guide \(exit offer\)/,
		} );
		await expect( option ).toBeVisible();
		await expect( option ).toContainText( 'modal' );
		await option.click();

		expect( await editor.getEditedPostContent() ).toContain(
			'<a href="#modal-field-guide"'
		);
	} );
} );

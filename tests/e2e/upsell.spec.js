/**
 * Upgrade prompts (mockups 4a–4d): listings only on our own screens,
 * dismissible, with a free path.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	newBlankModal,
	resetDismissals,
} = require( './utils/modals' );

test.describe( 'Upgrade prompts', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await resetDismissals( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await resetDismissals( requestUtils );
		await deleteAllModals( requestUtils );
	} );

	test( 'Pro collections in the picker offer a free look-alike', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { postType: 'mk_modal' } );
		const picker = page.getByRole( 'dialog', {
			name: 'Choose a starting layout',
		} );

		await picker.getByRole( 'button', { name: /^Shop\s*9/ } ).click();
		await picker.getByRole( 'button', { name: /Welcome offer/ } ).click();
		await expect(
			picker.getByText(
				'Uses Multi-step and Form, which come with Modal Kit Pro.'
			)
		).toBeVisible();
		await picker.getByRole( 'button', { name: 'Use it →' } ).click();

		const [ block ] = await editor.getBlocks();
		expect( block.attributes.modalLayout ).toBe( 'centered' );
		expect(
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/editor' )
					.getEditedPostAttribute( 'title' )
			)
		).toBe( 'Monthly letter' );
	} );

	test( '“Not now” hides the Pro collections, across reloads', async ( {
		admin,
		page,
	} ) => {
		await admin.createNewPost( { postType: 'mk_modal' } );
		const picker = page.getByRole( 'dialog', {
			name: 'Choose a starting layout',
		} );

		await picker.getByRole( 'button', { name: /^Shop\s*9/ } ).click();
		await picker.getByRole( 'button', { name: 'Not now' } ).click();
		await expect( picker.getByText( 'Pro collections' ) ).toHaveCount( 0 );
		await expect(
			picker.getByRole( 'button', { name: /^Shop\s*9/ } )
		).toHaveCount( 0 );
		await expect( picker.locator( 'button:focus' ) ).toBeVisible();
		await page.waitForTimeout( 500 );

		await page.reload();
		await expect(
			picker.getByRole( 'button', { name: /Monthly letter/ } )
		).toBeVisible();
		await expect( picker.getByText( 'Pro collections' ) ).toHaveCount( 0 );
	} );

	test( '“Not now” hides a listing for this user, across reloads', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await canvas.locator( '.modal-kit__panel p' ).first().click();
		await page.keyboard.type( '/buttons' );
		await page.keyboard.press( 'Enter' );
		await page.keyboard.type( 'Go' );
		await editor.openDocumentSettingsSidebar();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
		await sidebar.getByRole( 'tab', { name: 'Block' } ).click();

		await sidebar.getByRole( 'button', { name: /Go to step/ } ).click();
		await page.getByRole( 'button', { name: 'Not now' } ).click();
		await page.waitForTimeout( 500 );

		await page.reload();
		expect(
			await page.evaluate( () =>
				window.modalKitEditor.proListings.map(
					( listing ) => listing.key
				)
			)
		).not.toContain( 'go-to-step' );
	} );

	test( 'the Forms panel can be hidden for good', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page );
		await editor.openDocumentSettingsSidebar();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
		await sidebar.getByRole( 'tab', { name: 'Modal' } ).click();

		const toggle = sidebar.getByRole( 'button', { name: /^Forms/ } );
		if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) {
			await toggle.click();
		}
		await sidebar
			.getByRole( 'button', { name: 'Hide this panel' } )
			.click();
		await expect( toggle ).toHaveCount( 0 );

		await page.reload();
		await expect(
			page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByRole( 'button', { name: /^Forms/ } )
		).toHaveCount( 0 );
	} );

	test( 'WooCommerce triggers are listed only when WooCommerce is active', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const openAddTrigger = async () => {
			await newBlankModal( admin, page );
			await editor.openDocumentSettingsSidebar();
			const sidebar = page.getByRole( 'region', {
				name: 'Editor settings',
			} );
			await sidebar.getByRole( 'tab', { name: 'Modal' } ).click();
			const toggle = sidebar.getByRole( 'button', { name: /^Triggers/ } );
			if (
				( await toggle.getAttribute( 'aria-expanded' ) ) === 'false'
			) {
				await toggle.click();
			}
			await sidebar
				.getByRole( 'button', { name: 'Add trigger' } )
				.click();
		};

		await openAddTrigger();
		await expect( page.getByText( 'WooCommerce · detected' ) ).toHaveCount(
			0
		);

		await requestUtils.activatePlugin( 'woocommerce' );
		try {
			// WooCommerce redirects to its own onboarding once after activation.
			await admin.visitAdminPage( 'index.php' );
			await openAddTrigger();
			await expect(
				page.getByText( 'WooCommerce · detected' )
			).toBeVisible();
			// A plain listing: nothing here looks like a locked control.
			await expect( page.getByText( 'Added to cart' ) ).toBeVisible();
			await expect(
				page.getByRole( 'menuitem', { name: 'Added to cart' } )
			).toHaveCount( 0 );

			await page
				.getByRole( 'menu', { name: 'Add trigger' } )
				.getByRole( 'button', { name: 'Not now' } )
				.click();
			await expect(
				page.getByText( 'WooCommerce · detected' )
			).toHaveCount( 0 );
			await page.getByRole( 'button', { name: 'Add trigger' } ).click();
			await expect(
				page.getByText( 'WooCommerce · detected' )
			).toHaveCount( 0 );
		} finally {
			await requestUtils.deactivatePlugin( 'woocommerce' );
		}
	} );

	test( 'one milestone notice on the modal list, dismissed for good', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await deleteAllModals( requestUtils );
		for ( const slug of [ 'one', 'two', 'three' ] ) {
			await createModal( requestUtils, { slug } );
		}

		await admin.visitAdminPage( 'index.php' );
		await expect( page.locator( '.modal-kit-milestone' ) ).toHaveCount( 0 );

		await admin.visitAdminPage( 'edit.php', 'post_type=mk_modal' );
		const notice = page.locator( '.modal-kit-milestone' );
		await expect( notice ).toContainText( 'Three modals live. Nice.' );
		// Wait for the dismissal to be saved (a read, then this write),
		// not a fixed time: the full suite can be slow.
		const saved = page.waitForResponse(
			( response ) =>
				response.request().method() === 'POST' &&
				/users(\/|%2F)me/.test( response.url() )
		);
		await notice.getByRole( 'button', { name: /Dismiss/ } ).click();
		await saved;

		await page.reload();
		await expect( page.locator( '.modal-kit-milestone' ) ).toHaveCount( 0 );
	} );

	test( 'one “Go Pro” link on the Plugins screen', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( 'plugins.php' );
		const row = page.locator( 'tr[data-slug="modal-kit"]' );
		await expect( row.getByRole( 'link', { name: 'Go Pro' } ) ).toHaveCount(
			1
		);
		await expect(
			row.getByRole( 'link', { name: 'Settings' } )
		).toHaveCount( 1 );
	} );
} );

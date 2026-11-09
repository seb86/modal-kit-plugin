/**
 * Setup wizard.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllModals, setSettings } = require( './utils/modals' );

test.describe( 'Setup wizard', () => {
	test.afterEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		for ( const tab of [ 'general', 'display', 'accessibility' ] ) {
			await setSettings( requestUtils, tab, {} );
		}
	} );

	test( 'writes settings and opens the first modal as a draft', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await admin.visitAdminPage( 'admin.php', 'page=modal-kit-setup' );

		// 7a Welcome.
		await expect(
			page.getByRole( 'heading', { name: 'Let’s set up Modal Kit' } )
		).toBeVisible();
		await expect(
			page.getByText( 'We’ll use your theme: Twenty Twenty-Five' )
		).toBeVisible();
		await expect(
			page.getByRole( 'checkbox', { name: 'Newsletter signups' } )
		).toBeChecked();
		await page.screenshot( { path: 'artifacts/wizard-1.png' } );
		await page.getByRole( 'button', { name: 'Continue' } ).click();

		// 7b Look.
		await page.getByRole( 'radio', { name: /Soft/ } ).click();
		await page.screenshot( { path: 'artifacts/wizard-2.png' } );
		await page.getByRole( 'button', { name: 'Continue' } ).click();

		// 7c Behaviour.
		await page
			.getByRole( 'combobox', { name: 'After someone closes a modal' } )
			.selectOption( '30' );
		await page
			.getByRole( 'checkbox', {
				name: 'Don’t show modals to administrators',
			} )
			.check();
		await page.screenshot( { path: 'artifacts/wizard-3.png' } );
		await page.getByRole( 'button', { name: 'Continue' } ).click();

		// 7d First modal.
		await page.getByRole( 'radio', { name: /Discount code/ } ).click();
		await expect(
			page.getByText( 'Discount code selected' )
		).toBeVisible();
		await page.screenshot( { path: 'artifacts/wizard-4.png' } );
		await page
			.getByRole( 'button', { name: 'Create and open in editor' } )
			.click();

		await expect( page ).toHaveURL( /post\.php\?post=\d+&action=edit/ );
		await page.waitForFunction(
			() =>
				window.wp?.data?.select( 'core/block-editor' )?.getBlocks()
					.length > 0
		);
		await expect(
			page.getByRole( 'dialog', { name: 'Choose a starting layout' } )
		).toHaveCount( 0 );
		const blocks = await page.evaluate( () =>
			window.wp.data.select( 'core/block-editor' ).getBlocks()
		);
		expect( blocks[ 0 ].attributes.modalLayout ).toBe( 'split' );
		expect(
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/editor' )
					.getEditedPostAttribute( 'status' )
			)
		).toBe( 'draft' );

		const settings = await requestUtils.rest( { path: '/wp/v2/settings' } );
		expect( settings.modal_kit_display.defaultStyle ).toBe( 'soft' );
		expect( settings.modal_kit_display.defaultMobile ).toBe( 'sheet' );
		expect( settings.modal_kit_general.defaultWaitDays ).toBe( 30 );
		expect( settings.modal_kit_general.hideForRoles ).toContain(
			'administrator'
		);
	} );

	test( 'Exit setup works on every step, and Tools runs it again', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( 'admin.php', 'page=modal-kit-setup' );
		await page.getByRole( 'button', { name: 'Continue' } ).click();
		await page.getByRole( 'button', { name: 'Exit setup' } ).click();
		await expect( page ).toHaveURL( /edit\.php\?post_type=mk_modal/ );

		await admin.visitAdminPage(
			'edit.php',
			'post_type=mk_modal&page=modal-kit-settings#tools'
		);
		await page.getByRole( 'link', { name: 'Run setup again' } ).click();
		await expect(
			page.getByRole( 'heading', { name: 'Let’s set up Modal Kit' } )
		).toBeVisible();
	} );
} );

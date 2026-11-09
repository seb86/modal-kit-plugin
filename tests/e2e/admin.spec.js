/**
 * Admin screens: the modal list and Settings.
 */
const fs = require( 'fs' );
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	setSettings,
} = require( './utils/modals' );

const LIST = 'edit.php';
const LIST_QUERY = 'post_type=mk_modal';
const SETTINGS_QUERY = 'post_type=mk_modal&page=modal-kit-settings';

/**
 * Reads a finished download. On Windows a scanner can hold new files for a
 * moment (EPERM / EBUSY), so the read is retried for up to five seconds.
 *
 * @param {import('@playwright/test').Download} download Download.
 * @return {Promise<string>} Contents.
 */
async function readDownload( download ) {
	const file = await download.path();

	for ( let attempt = 0; ; attempt++ ) {
		try {
			return fs.readFileSync( file, 'utf8' );
		} catch ( error ) {
			if (
				attempt >= 20 ||
				! [ 'EPERM', 'EBUSY' ].includes( error.code )
			) {
				throw error;
			}
			await new Promise( ( resolve ) => setTimeout( resolve, 250 ) );
		}
	}
}

test.describe( 'Modal list', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test( 'shows layout, triggers and targeting, and switches modals on and off', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'autumn-sale',
			title: 'Autumn sale',
			attributes: { modalLayout: 'split' },
			meta: {
				triggers: [ { type: 'scroll', percent: 50 }, { type: 'exit' } ],
				rules: {
					showOn: {
						mode: 'include',
						include: [ '/shop/*', '/' ],
						exclude: [],
						postTypes: [],
					},
				},
			},
		} );
		await createModal( requestUtils, {
			slug: 'holiday-hours',
			title: 'Holiday hours',
		} );

		await admin.visitAdminPage( LIST, LIST_QUERY );
		await page.screenshot( {
			path: 'artifacts/admin-list.png',
			fullPage: true,
		} );

		const row = page.locator( '#the-list tr', { hasText: 'Autumn sale' } );
		await expect( row.locator( '.column-modal_kit_layout' ) ).toHaveText(
			'Split'
		);
		await expect( row.locator( '.column-modal_kit_triggers' ) ).toHaveText(
			'Scroll 50%, Leaving the page, Click #modal-autumn-sale'
		);
		await expect( row.locator( '.column-modal_kit_shows_on' ) ).toHaveText(
			'/shop/*, Home'
		);
		await expect(
			row.getByRole( 'button', { name: /Copy link/ } )
		).toBeAttached();
		await expect(
			page.getByRole( 'link', { name: /Active \(2\)/ } )
		).toBeVisible();

		const toggle = row.getByRole( 'switch' );
		await expect( toggle ).toHaveAttribute( 'aria-checked', 'true' );
		await toggle.click();
		await expect( toggle ).toHaveAttribute( 'aria-checked', 'false' );
		await expect( toggle ).toBeEnabled();

		await page.reload();
		await expect( row.getByRole( 'switch' ) ).toHaveAttribute(
			'aria-checked',
			'false'
		);
		await expect(
			page.getByRole( 'link', { name: /Active \(1\)/ } )
		).toBeVisible();

		// A switched-off modal is not printed.
		await page.goto( '/?modal=autumn-sale' );
		await expect( page.locator( '#modal-autumn-sale' ) ).toHaveCount( 0 );
	} );

	test( 'duplicates a modal as a draft', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'autumn-sale',
			title: 'Autumn sale',
			meta: { triggers: [ { type: 'load', delay: 3 } ] },
		} );

		await admin.visitAdminPage( LIST, LIST_QUERY );
		const row = page.locator( '#the-list tr', { hasText: 'Autumn sale' } );
		await row.hover();
		await row.getByRole( 'link', { name: 'Duplicate' } ).click();

		await expect( page ).toHaveURL( /post\.php\?post=\d+&action=edit/ );
		const copies = await requestUtils.rest( {
			path: '/wp/v2/mk_modal',
			params: { status: 'draft', context: 'edit' },
		} );
		expect( copies ).toHaveLength( 1 );
		expect( copies[ 0 ].title.raw ).toBe( 'Autumn sale (copy)' );
		expect( copies[ 0 ].meta._modal_kit_triggers ).toEqual( [
			{ type: 'load', delay: 3 },
		] );
	} );
} );

test.describe( 'Settings', () => {
	test.afterEach( async ( { requestUtils } ) => {
		for ( const tab of [
			'general',
			'display',
			'accessibility',
			'tools',
			'pro',
		] ) {
			await setSettings( requestUtils, tab, {} );
		}
		await deleteAllModals( requestUtils );
	} );

	test( 'general settings save through the Settings API', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await admin.visitAdminPage( LIST, SETTINGS_QUERY );
		await expect(
			page.getByRole( 'heading', { name: 'Links' } )
		).toBeVisible();
		await page.screenshot( {
			path: 'artifacts/admin-settings-general.png',
			fullPage: true,
		} );

		await page.getByLabel( 'Auto-open limit' ).selectOption( '0' );
		await page.getByLabel( 'Link prefix' ).fill( 'popup-' );
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		await expect(
			page
				.locator( '.modal-kit-settings__notice' )
				.getByText( 'Settings saved.' )
		).toBeVisible();

		const settings = await requestUtils.rest( { path: '/wp/v2/settings' } );
		expect( settings.modal_kit_general ).toMatchObject( {
			autoOpenLimit: 0,
			linkPrefix: 'popup-',
		} );
	} );

	test( 'the display preview shows a modal on the real front end', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( LIST, SETTINGS_QUERY + '#display' );
		await page
			.getByLabel( 'Layout', { exact: true } )
			.selectOption( 'drawer' );

		const preview = page.frameLocator( '.modal-kit-preview iframe' );
		await expect(
			preview.locator( 'dialog.modal-kit--drawer[open]' )
		).toBeVisible( {
			timeout: 15000,
		} );
		await expect( preview.locator( '#wpadminbar' ) ).toHaveCount( 0 );
		await page.screenshot( {
			path: 'artifacts/admin-settings-display.png',
			fullPage: true,
		} );
	} );

	test( 'accessibility defaults reach the front end', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'a11y' } );
		await admin.visitAdminPage( LIST, SETTINGS_QUERY + '#accessibility' );
		await page.getByLabel( 'Close button label' ).fill( 'Fermer' );
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		await expect(
			page
				.locator( '.modal-kit-settings__notice' )
				.getByText( 'Settings saved.' )
		).toBeVisible();

		await page.goto( '/?modal=a11y' );
		await expect(
			page.locator( '#modal-a11y .modal-kit__close' )
		).toHaveAttribute( 'aria-label', 'Fermer' );
	} );

	test( 'export and import round-trip modals', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'exported',
			title: 'Exported',
			meta: { triggers: [ { type: 'scroll', percent: 40 } ] },
		} );
		await admin.visitAdminPage( LIST, SETTINGS_QUERY + '#tools' );

		const [ download ] = await Promise.all( [
			page.waitForEvent( 'download' ),
			page.getByRole( 'button', { name: 'Download .json' } ).click(),
		] );
		const json = await readDownload( download );
		const data = JSON.parse( json );
		expect( data.plugin ).toBe( 'modal-kit' );
		expect( data.modals[ 0 ] ).toMatchObject( {
			slug: 'exported',
			title: 'Exported',
		} );
		expect( data.settings.general.autoOpenLimit ).toBe( 1 );

		await deleteAllModals( requestUtils );
		await page.locator( 'input[type="file"]' ).setInputFiles( {
			name: 'modal-kit-export.json',
			mimeType: 'application/json',
			buffer: Buffer.from( json ),
		} );
		await expect(
			page
				.locator( '.modal-kit-settings__notice' )
				.getByText( /Imported: 1 new, 0 updated, 0 skipped/ )
		).toBeVisible();

		const imported = await requestUtils.rest( {
			path: '/wp/v2/mk_modal',
			params: { context: 'edit' },
		} );
		expect( imported[ 0 ].slug ).toBe( 'exported' );
		expect( imported[ 0 ].meta._modal_kit_triggers ).toEqual( [
			{ type: 'scroll', percent: 40 },
		] );
	} );

	test( 'Pro tips can be turned off for everyone', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.visitAdminPage( LIST, SETTINGS_QUERY + '#pro' );
		await expect(
			page.getByRole( 'heading', { name: 'What Pro adds' } )
		).toBeVisible();
		await page
			.getByLabel( 'Show Pro features in menus and pickers' )
			.click();
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		await expect(
			page
				.locator( '.modal-kit-settings__notice' )
				.getByText( 'Settings saved.' )
		).toBeVisible();

		await admin.createNewPost( { postType: 'mk_modal' } );
		await page.getByRole( 'button', { name: 'Start blank' } ).click();
		expect(
			await page.evaluate( () => window.modalKitEditor.proListings )
		).toEqual( [] );
		await editor.openDocumentSettingsSidebar();
	} );
} );

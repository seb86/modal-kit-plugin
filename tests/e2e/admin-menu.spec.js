/**
 * The plugin adds its admin menu and the editor starts with the Modal block.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { newBlankModal } = require( './utils/modals' );

test.describe( 'Admin menu', () => {
	test( 'shows the Modal Kit menu with its modal screens', async ( {
		admin,
		page,
	} ) => {
		await admin.visitAdminPage( 'index.php' );

		const menu = page.locator( '#menu-posts-mk_modal' );
		await expect( menu ).toContainText( 'Modal Kit' );
		await expect(
			menu.getByRole( 'link', { name: 'All Modals' } )
		).toBeAttached();
		await expect(
			menu.getByRole( 'link', { name: 'Add New Modal' } )
		).toBeAttached();

		await admin.visitAdminPage( 'edit.php', 'post_type=mk_modal' );
		await expect(
			page.getByRole( 'heading', { name: 'Modals', level: 1 } )
		).toBeVisible();
	} );

	test( 'a new modal starts with one locked Modal block', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page );

		const blocks = await editor.getBlocks();
		expect( blocks ).toHaveLength( 1 );
		expect( blocks[ 0 ].name ).toBe( 'modal-kit/modal' );
		expect( blocks[ 0 ].attributes.lock ).toEqual( {
			move: true,
			remove: true,
		} );
	} );
} );

/**
 * Every layout looks the same in the editor and on the front end, at desktop
 * and at 375px. The panel's placement inside its container
 * (which edges it touches, whether it is centred) must match, and each view
 * is compared against a visual baseline.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	newBlankModal,
} = require( './utils/modals' );

const LAYOUTS = [
	[ 'centered' ],
	[ 'corner', 'bottom-right' ],
	[ 'bar', 'top' ],
	[ 'full' ],
	[ 'drawer', 'right' ],
	[ 'split', 'media-left' ],
	[ 'sheet' ],
	[ 'inline' ],
];

const VIEWPORTS = {
	desktop: { width: 1280, height: 800 },
	mobile: { width: 375, height: 740 },
};

/**
 * Describes where a panel sits inside its container, in a form that does
 * not depend on the container's size.
 *
 * @param {Object} panel     Panel bounding box.
 * @param {Object} container Container bounding box.
 * @return {Object} Placement.
 */
function placement( panel, container ) {
	const tolerance = 3;
	const near = ( a, b ) => Math.abs( a - b ) <= tolerance;

	return {
		top: near( panel.y, container.y ),
		bottom: near( panel.y + panel.height, container.y + container.height ),
		left: near( panel.x, container.x ),
		right: near( panel.x + panel.width, container.x + container.width ),
		centredX: near(
			panel.x + panel.width / 2,
			container.x + container.width / 2
		),
		fullWidth: panel.width >= container.width - 2 * tolerance,
	};
}

test.describe( 'Layouts', () => {
	const ids = {};

	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );

		for ( const [ layout, position ] of LAYOUTS ) {
			const post = await createModal( requestUtils, {
				slug: `layout-${ layout }`,
				attributes: {
					modalLayout: layout,
					...( position ? { position } : {} ),
				},
			} );
			ids[ layout ] = post.id;
		}
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test( 'the sidebar switches layout, position and size', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page, { title: 'Switch' } );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		const container = canvas.locator( '.modal-kit.is-editor-preview' );

		await editor.selectBlocks( container );
		await editor.openDocumentSettingsSidebar();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );

		await sidebar
			.getByRole( 'radiogroup', { name: 'Layout' } )
			.getByRole( 'radio', { name: 'Drawer' } )
			.click();
		await expect( container ).toHaveClass( /modal-kit--drawer/ );
		await expect( container ).toHaveClass( /modal-kit--pos-right/ );

		await sidebar
			.getByRole( 'combobox', { name: 'Position' } )
			.selectOption( 'left' );
		await expect( container ).toHaveClass( /modal-kit--pos-left/ );

		await sidebar
			.getByRole( 'radiogroup', { name: 'Size' } )
			.getByRole( 'radio', { name: 'L' } )
			.click();
		await expect( container ).toHaveClass( /modal-kit--size-l/ );

		const [ block ] = await editor.getBlocks();
		expect( block.attributes ).toMatchObject( {
			modalLayout: 'drawer',
			position: 'left',
			size: 'l',
		} );

		await sidebar.getByRole( 'tab', { name: 'Styles' } ).click();
		await expect(
			sidebar.getByRole( 'radio', { name: 'Soft' } )
		).toBeVisible();
		await expect(
			sidebar.getByRole( 'radio', { name: 'Editorial' } )
		).toBeVisible();
	} );

	for ( const [ viewportName, viewport ] of Object.entries( VIEWPORTS ) ) {
		for ( const [ layout ] of LAYOUTS ) {
			test( `${ layout } matches in the editor and on the front end (${ viewportName })`, async ( {
				admin,
				page,
			} ) => {
				await page.setViewportSize( viewport );

				// Front end.
				await page.goto( `/?modal=layout-${ layout }` );
				const dialog = page.locator( `#modal-layout-${ layout }` );
				if ( layout === 'inline' ) {
					await expect( dialog ).toHaveAttribute( 'open', '' );
				} else {
					await expect( dialog ).toBeVisible();
				}
				const frontPanel = dialog.locator( '.modal-kit__panel' );
				await expect( frontPanel ).toBeVisible();
				await page.waitForTimeout( 500 ); // Opening animation.

				const front = placement(
					await frontPanel.boundingBox(),
					await dialog.boundingBox()
				);
				await expect( dialog ).toHaveScreenshot(
					`front-${ layout }-${ viewportName }.png`,
					{ maxDiffPixelRatio: 0.02 }
				);

				// Editor.
				await admin.editPost( ids[ layout ] );
				// Same canvas width every time: the sidebar state persists.
				await page.evaluate( () =>
					window.wp.data
						.dispatch( 'core/edit-post' )
						.closeGeneralSidebar()
				);
				const canvas = page.frameLocator(
					'iframe[name="editor-canvas"]'
				);
				const container = canvas.locator(
					'.modal-kit.is-editor-preview'
				);
				const editorPanel = container.locator( '.modal-kit__panel' );
				await expect( editorPanel ).toBeVisible();

				const editor = placement(
					await editorPanel.boundingBox(),
					await container.boundingBox()
				);

				if ( layout === 'inline' ) {
					// Inline sits in the page flow on the front end and on a
					// stage in the editor: only the horizontal placement compares.
					expect( editor.centredX ).toBe( front.centredX );
					expect( editor.fullWidth ).toBe( front.fullWidth );
				} else {
					expect( editor ).toEqual( front );
				}

				await expect( container ).toHaveScreenshot(
					`editor-${ layout }-${ viewportName }.png`,
					{ maxDiffPixelRatio: 0.02 }
				);
			} );
		}
	}
} );

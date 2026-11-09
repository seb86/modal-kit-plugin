/**
 * The style picker, search, import and export:
 * keyboard selection with preview and revert, search with 7+ styles, an
 * import → apply → export round trip that gives the same JSON, deleting a
 * style in use, and the picker's look in Twenty Twenty-Five and Ollie.
 */
const { writeFileSync, mkdtempSync } = require( 'node:fs' );
const { join } = require( 'node:path' );
const { tmpdir } = require( 'node:os' );
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	newBlankModal,
} = require( './utils/modals' );

// The export format: two-space JSON, keys in the schema's order.
const TERRACOTTA = `${ JSON.stringify(
	{
		slug: 'terracotta',
		label: 'Terracotta',
		description: 'Warm cream, rust, serif headings',
		version: 1,
		color: {
			surface: '#FFFAF6',
			ink: '#3B2219',
			muted: '#6B4A3E',
			line: '#EADFD6',
			field: '#9C8478',
			accent: '#9E3A1F',
			'accent-strong': '#7A2E14',
			'on-accent': '#FFFFFF',
			tint: '#F6E9E1',
			overlay: 'rgba(40,20,12,.5)',
			'full-bg': '#3B2219',
			'full-ink': '#FFFAF6',
			'full-accent': '#F0B49E',
		},
		font: {
			head: "'Instrument Serif', serif",
			body: "'Instrument Sans', sans-serif",
			mono: "'IBM Plex Mono', monospace",
			'head-weight': 400,
			'head-tracking': '-0.01em',
		},
		radius: { panel: '6px', button: '3px', field: '3px' },
		shadow: '0 18px 40px rgba(40,20,12,.22)',
	},
	null,
	2
) }\n`;

/**
 * Imports a style through the REST route.
 *
 * @param {Object} requestUtils e2e request utils.
 * @param {Object} style        Style JSON.
 * @return {Promise<Object>} Saved item.
 */
async function importStyle( requestUtils, style ) {
	const { item } = await requestUtils.rest( {
		path: '/modal-kit/v1/styles',
		method: 'POST',
		data: { style },
	} );

	return item;
}

/**
 * Deletes every style of yours.
 *
 * @param {Object} requestUtils e2e request utils.
 */
async function deleteStyles( requestUtils ) {
	const { styles } = await requestUtils.rest( {
		path: '/modal-kit/v1/styles',
	} );

	for ( const style of styles ) {
		if ( [ 'yours', 'imported' ].includes( style.source ) ) {
			await requestUtils.rest( {
				path: `/modal-kit/v1/styles/${ style.slug }?reassign=default`,
				method: 'DELETE',
			} );
		}
	}
}

/**
 * Opens a new blank modal with the Styles tab showing.
 *
 * @param {Object} admin  Admin utils.
 * @param {Object} editor Editor utils.
 * @param {Object} page   Page.
 * @return {Promise<Object>} { sidebar, container, group }.
 */
async function openPicker( admin, editor, page ) {
	await newBlankModal( admin, page, { title: 'Picker' } );
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	const container = canvas.locator( '.modal-kit.is-editor-preview' );

	await editor.selectBlocks( container );
	await editor.openDocumentSettingsSidebar();
	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	await sidebar.getByRole( 'tab', { name: 'Styles' } ).click();

	return {
		sidebar,
		container,
		group: sidebar.getByRole( 'radiogroup', { name: 'Style' } ),
	};
}

test.describe( 'Style picker', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await deleteStyles( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await deleteStyles( requestUtils );
		await deleteAllModals( requestUtils );
		await requestUtils.activateTheme( 'twentytwentyfive' );
	} );

	test( 'arrow keys preview on the canvas, Enter applies as one undo step, Esc reverts', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await requestUtils.activateTheme( 'twentytwentyfive' );
		const { group, container } = await openPicker( admin, editor, page );

		// Core's block style buttons are gone; the tiles replace them.
		await expect(
			page.locator( '.block-editor-block-styles' )
		).toHaveCount( 0 );

		const native = group.getByRole( 'radio', { name: 'Native' } );
		await expect( native ).toHaveAttribute( 'aria-checked', 'true' );
		await expect( native ).toHaveAttribute( 'tabindex', '0' );
		await expect(
			group.getByRole( 'radio', { name: 'Harbor' } )
		).toHaveAttribute( 'tabindex', '-1' );

		// Arrow to Fieldnote (Native, Soft, Editorial, Fieldnote).
		await native.focus();
		for ( let step = 0; step < 3; step++ ) {
			await page.keyboard.press( 'ArrowRight' );
		}
		await expect(
			group.getByRole( 'radio', { name: 'Fieldnote' } )
		).toBeFocused();
		await expect( container ).toHaveClass( /mk-style-fieldnote/ );
		expect( ( await editor.getBlocks() )[ 0 ].attributes.className ).toBe(
			undefined
		);

		// Esc reverts to what's applied.
		await page.keyboard.press( 'Escape' );
		await expect( container ).not.toHaveClass( /mk-style-fieldnote/ );

		// Arrow to Harbor and apply it.
		await group.getByRole( 'radio', { name: 'Fieldnote' } ).focus();
		await page.keyboard.press( 'ArrowRight' );
		await page.keyboard.press( 'Enter' );
		await expect(
			group.getByRole( 'radio', { name: 'Harbor' } )
		).toHaveAttribute( 'aria-checked', 'true' );
		await expect( container ).toHaveClass( /mk-style-harbor/ );
		expect( ( await editor.getBlocks() )[ 0 ].attributes.className ).toBe(
			'is-style-harbor'
		);

		// Hover previews, mouse-out reverts.
		await group.getByRole( 'radio', { name: 'Night' } ).hover();
		await expect( container ).toHaveClass( /mk-style-night/ );
		await page.mouse.move( 0, 0 );
		await expect( container ).toHaveClass( /mk-style-harbor/ );

		// One undo step back to Native.
		await page.keyboard.press( 'Control+z' );
		await expect
			.poll(
				async () =>
					( await editor.getBlocks() )[ 0 ].attributes.className
			)
			.toBeFalsy();
	} );

	test( 'search shows with 7 or more styles and marks the match', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const { group: few, sidebar: before } = await openPicker(
			admin,
			editor,
			page
		);
		await expect( few ).toBeVisible();
		await expect(
			before.getByRole( 'searchbox', { name: 'Search styles' } )
		).toHaveCount( 0 );

		const base = JSON.parse( TERRACOTTA );
		await importStyle( requestUtils, base );
		await importStyle( requestUtils, {
			...base,
			slug: 'clinic',
			label: 'Clinic',
			description: 'Calm and clean',
		} );

		const { sidebar, group } = await openPicker( admin, editor, page );
		const search = sidebar.getByRole( 'searchbox', {
			name: 'Search styles',
		} );

		await expect(
			sidebar.getByRole( 'group', { name: 'Your styles' } )
		).toBeVisible();
		await search.fill( 'dark' );
		await expect( sidebar.getByText( '2 of 8 styles' ) ).toBeVisible();
		await expect( group.getByRole( 'radio' ) ).toHaveCount( 2 );
		await expect( group.locator( 'mark' ).first() ).toHaveText( /dark/i );
		await expect(
			sidebar.getByRole( 'group', { name: 'Your styles' } )
		).toHaveCount( 0 );

		await search.fill( 'neon' );
		await expect(
			sidebar.getByText( 'No styles match “neon”.' )
		).toBeVisible();
		await expect(
			sidebar.getByRole( 'button', { name: 'Import a style' } )
		).toBeVisible();

		await search.press( 'Escape' );
		await expect( search ).toHaveValue( '' );
		await expect( group.getByRole( 'radio' ) ).toHaveCount( 8 );
	} );

	test( 'import → apply → export gives the same JSON', async ( {
		admin,
		editor,
		page,
	} ) => {
		const dir = mkdtempSync( join( tmpdir(), 'modal-kit-style-' ) );
		const file = join( dir, 'terracotta.json' );
		writeFileSync( file, TERRACOTTA );

		const { sidebar, container } = await openPicker( admin, editor, page );

		await sidebar.getByRole( 'button', { name: 'Style actions' } ).click();
		await page.getByRole( 'menuitem', { name: /Import style/ } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Import a style' } );
		const chooser = page.waitForEvent( 'filechooser' );
		await dialog.getByRole( 'button', { name: 'Choose a file' } ).click();
		await ( await chooser ).setFiles( file );

		await expect( dialog.getByLabel( 'Name' ) ).toHaveValue( 'Terracotta' );
		await expect( dialog ).toContainText(
			'13 of 13 colours and 3 of 3 corner sizes found'
		);
		await expect( dialog ).toContainText( 'Contrast passes' );
		await dialog
			.getByRole( 'button', { name: 'Import and apply' } )
			.click();
		await expect( dialog ).toBeHidden();

		await expect( container ).toHaveClass( /mk-style-terracotta/ );
		// Its rule reached the canvas without a reload.
		await expect( container.locator( '.modal-kit__panel' ) ).toHaveCSS(
			'background-color',
			'rgb(255, 250, 246)'
		);
		expect( ( await editor.getBlocks() )[ 0 ].attributes.className ).toBe(
			'is-style-terracotta'
		);

		// Keep what the export hands the browser (a Blob URL download).
		await page.evaluate( () => {
			const create = window.URL.createObjectURL;
			window.URL.createObjectURL = ( blob ) => {
				blob.text().then(
					( text ) => ( window.modalKitExported = text )
				);
				return create.call( window.URL, blob );
			};
		} );
		await sidebar.getByRole( 'button', { name: 'Style actions' } ).click();
		const download = page.waitForEvent( 'download' );
		await page
			.getByRole( 'menuitem', { name: 'Export “Terracotta”' } )
			.click();
		expect( ( await download ).suggestedFilename() ).toBe(
			'terracotta.json'
		);
		await page.waitForFunction( () => window.modalKitExported );

		expect( await page.evaluate( () => window.modalKitExported ) ).toBe(
			TERRACOTTA
		);
	} );

	test( 'deleting a style in use asks which style its modals switch to', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		await importStyle( requestUtils, JSON.parse( TERRACOTTA ) );
		const modal = await createModal( requestUtils, {
			slug: 'uses-terracotta',
			attributes: { className: 'is-style-terracotta' },
		} );

		await admin.visitAdminPage(
			'edit.php',
			'post_type=mk_modal&page=modal-kit-settings#styles'
		);
		const row = page.getByRole( 'row', { name: /Terracotta/ } );
		await expect( row ).toContainText( 'Imported' );
		await expect( row ).toContainText( '1 modal' );
		await expect(
			page
				.getByRole( 'row', { name: /Harbor/ } )
				.getByRole( 'button', { name: 'Delete' } )
		).toHaveCount( 0 );

		await row.getByRole( 'button', { name: 'Delete' } ).click();
		const dialog = page.getByRole( 'dialog', {
			name: 'Delete “Terracotta”?',
		} );
		await expect( dialog ).toContainText( '1 modal uses this style' );
		await dialog
			.getByRole( 'combobox', { name: 'Switch them to' } )
			.selectOption( 'harbor' );
		await dialog
			.getByRole( 'button', { name: 'Switch and delete' } )
			.click();
		// The open dialog hides the table from the accessibility tree, so
		// wait for it to close and the notice before looking at the modal.
		await expect( dialog ).toBeHidden();
		await expect(
			page.getByText( '“Terracotta” deleted.' ).first()
		).toBeVisible();
		await expect( row ).toHaveCount( 0 );

		const updated = await requestUtils.rest( {
			path: `/wp/v2/mk_modal/${ modal.id }`,
			params: { context: 'edit' },
		} );
		expect( updated.content.raw ).toContain( 'is-style-harbor' );
		expect( updated.content.raw ).not.toContain( 'is-style-terracotta' );
	} );

	for ( const theme of [ 'twentytwentyfive', 'ollie' ] ) {
		test( `the picker in ${ theme }`, async ( {
			admin,
			editor,
			page,
			requestUtils,
		} ) => {
			await requestUtils.activateTheme( theme );
			await page.setViewportSize( { width: 1280, height: 1100 } );
			const { sidebar } = await openPicker( admin, editor, page );
			const panel = sidebar
				.getByRole( 'radiogroup', { name: 'Style' } )
				.locator(
					'xpath=ancestor::div[contains(@class,"components-panel__body")][1]'
				);

			await expect( panel ).toHaveScreenshot(
				`style-picker-${ theme }.png`,
				{
					maxDiffPixelRatio: 0.02,
				}
			);
		} );
	}
} );

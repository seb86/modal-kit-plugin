/**
 * The Modal sidebar panels: Triggers and Display rules (1f), Accessibility
 * overrides (5c).
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllModals, newBlankModal } = require( './utils/modals' );

/**
 * Opens the "Modal" tab of the settings sidebar and expands a panel.
 *
 * @param {Object} page   Playwright page.
 * @param {Object} editor e2e editor utils.
 * @param {string} name   Panel title (start).
 * @return {Promise<Object>} The panel locator.
 */
async function openPanel( page, editor, name ) {
	await editor.openDocumentSettingsSidebar();
	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	await sidebar.getByRole( 'tab', { name: 'Modal' } ).click();

	const toggle = sidebar.getByRole( 'button', {
		name: new RegExp( `^${ name }` ),
	} );
	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) {
		await toggle.click();
	}

	return toggle.locator(
		'xpath=ancestor::div[contains(@class, "components-panel__body")][1]'
	);
}

/**
 * The saved meta of the post being edited.
 *
 * @param {Object} page Playwright page.
 * @return {Promise<Object>} Meta.
 */
function savedMeta( page ) {
	return page.evaluate( () => {
		const editor = window.wp.data.select( 'core/editor' );
		return window.wp
			.apiFetch( {
				path: `/wp/v2/mk_modal/${ editor.getCurrentPostId() }?context=edit`,
			} )
			.then( ( post ) => post.meta );
	} );
}

test.describe( 'Modal sidebar panels', () => {
	test.afterEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test( 'triggers: link address and an automatic trigger', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page, { title: 'Autumn sale' } );
		await editor.publishPost();

		const panel = await openPanel( page, editor, 'Triggers' );
		await expect( panel.getByText( '#modal-autumn-sale' ) ).toBeVisible();

		await panel.getByRole( 'button', { name: 'Add trigger' } ).click();
		await page.getByRole( 'menuitem', { name: /Scroll depth/ } ).click();
		await panel
			.getByRole( 'spinbutton', { name: 'Percent of the page' } )
			.fill( '30' );
		await expect(
			panel.getByRole( 'button', { name: /^Triggers \(1\)/ } )
		).toBeVisible();

		await page.evaluate( () =>
			window.wp.data.dispatch( 'core/editor' ).savePost()
		);
		await page.waitForFunction(
			() =>
				! window.wp.data.select( 'core/editor' ).isSavingPost() &&
				! window.wp.data.select( 'core/editor' ).isEditedPostDirty()
		);

		const meta = await savedMeta( page );
		expect( meta._modal_kit_triggers ).toEqual( [
			{ type: 'scroll', percent: 30 },
		] );
	} );

	test( 'display rules are saved to the modal', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		// Two pages share a title: each suggestion adds its path.
		const leftovers = await requestUtils.rest( {
			path: '/wp/v2/pages',
			params: { search: 'Pricing guide', status: 'any', per_page: 50 },
		} );
		for ( const leftover of leftovers ) {
			await requestUtils.rest( {
				path: `/wp/v2/pages/${ leftover.id }`,
				method: 'DELETE',
				params: { force: true },
			} );
		}
		const pricing = await requestUtils.createPage( {
			title: 'Pricing guide',
			status: 'publish',
		} );
		const twin = await requestUtils.createPage( {
			title: 'Pricing guide',
			status: 'publish',
		} );
		const pricingPath = new URL( pricing.link ).pathname;
		await newBlankModal( admin, page, { title: 'Rules' } );
		const panel = await openPanel( page, editor, 'Display rules' );

		// One list per choice.
		await panel.getByRole( 'radio', { name: 'Everywhere except' } ).check();
		await expect(
			panel.getByRole( 'combobox', { name: 'Except these pages' } )
		).toBeVisible();
		await expect(
			panel.getByRole( 'combobox', { name: 'Pages', exact: true } )
		).toHaveCount( 0 );

		await panel.getByRole( 'radio', { name: 'Only these pages' } ).check();
		const pages = panel.getByRole( 'combobox', {
			name: 'Pages',
			exact: true,
		} );
		const except = panel.getByRole( 'combobox', {
			name: 'Except',
			exact: true,
		} );
		await expect( except ).toHaveCount( 0 );

		// Listing a section offers exceptions inside it.
		await pages.fill( '/shop/*' );
		await page.keyboard.press( 'Enter' );
		await expect( except ).toBeVisible();

		// Search by title as you type; the pick shows its title.
		await pages.fill( 'Pricing' );
		await expect(
			page.getByRole( 'listbox' ).getByRole( 'option' )
		).toHaveCount( 2 );
		await page
			.getByRole( 'option', {
				name: `Pricing guide — Page (${ pricingPath })`,
				exact: true,
			} )
			.click();
		await expect( panel ).toContainText(
			`Pricing guide — Page (${ pricingPath })`
		);

		// The homepage is offered by name, whatever the front page is.
		await pages.fill( 'home' );
		await page.getByRole( 'option', { name: 'Homepage' } ).click();
		await expect( panel ).toContainText( 'Homepage' );
		await expect(
			panel.getByText( 'Separate with commas' ).first()
		).toBeHidden();
		await panel
			.getByRole( 'combobox', { name: 'Frequency' } )
			.selectOption( 'always' );
		await panel
			.getByRole( 'button', { name: 'Mobile', exact: true } )
			.click();
		await panel
			.getByRole( 'checkbox', { name: 'Hide for logged-in users' } )
			.check();
		await panel
			.getByRole( 'spinbutton', {
				name: 'At most this many times in total',
			} )
			.fill( '3' );
		await panel
			.getByRole( 'combobox', { name: 'Browsers' } )
			.selectOption( 'except' );
		await panel
			.getByRole( 'button', { name: 'In-app browsers', exact: true } )
			.click();

		// Without Pro, the visit count is offered as a Pro listing.
		if ( ! ( await page.evaluate( () => !! window.modalKitProEditor ) ) ) {
			await expect(
				panel.getByText( 'Wait for a returning visitor' )
			).toBeVisible();
		}

		await editor.publishPost();
		const { _modal_kit_rules: rules } = await savedMeta( page );

		expect( rules.showOn ).toMatchObject( {
			mode: 'include',
			include: [ '/shop/*', `post:${ pricing.id }`, '/' ],
		} );
		expect( rules.frequency.mode ).toBe( 'always' );
		expect( rules.devices ).toEqual( [ 'desktop', 'tablet' ] );
		expect( rules.visitors.hideLoggedIn ).toBe( true );
		expect( rules.frequency.maxShows ).toBe( 3 );
		expect( rules.browsers ).toEqual( {
			mode: 'except',
			list: [ 'in-app' ],
		} );

		// Reopened later, the saved page still shows its title.
		await page.reload();
		const again = await openPanel( page, editor, 'Display rules' );
		await expect( again ).toContainText( 'Pricing guide — Page' );
		await expect( again ).toContainText( 'Homepage' );
		await expect( again ).not.toContainText( `post:${ pricing.id }` );

		for ( const created of [ pricing, twin ] ) {
			await requestUtils.rest( {
				path: `/wp/v2/pages/${ created.id }`,
				method: 'DELETE',
				params: { force: true },
			} );
		}
	} );

	test( 'accessibility overrides are marked and can be reset', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page, { title: 'Overrides' } );
		const panel = await openPanel( page, editor, 'Accessibility' );

		await panel
			.getByRole( 'textbox', { name: 'Close button label' } )
			.fill( 'Dismiss' );
		await panel
			.getByRole( 'combobox', { name: 'Focus when opened' } )
			.selectOption( 'close' );
		await expect(
			panel.getByText( /Overridden · site default is the heading/ )
		).toBeVisible();
		await expect(
			panel.locator( '.modal-kit-override-dot' )
		).toBeVisible();

		await editor.publishPost();
		const slug = await page.evaluate( () =>
			window.wp.data
				.select( 'core/editor' )
				.getEditedPostAttribute( 'slug' )
		);
		expect( ( await savedMeta( page ) )._modal_kit_overrides ).toEqual( {
			accessibility: { closeLabel: 'Dismiss', focus: 'close' },
		} );

		// The front end uses the override.
		await page.goto( `/?modal=${ slug }` );
		const close = page.locator( `#modal-${ slug } .modal-kit__close` );
		await expect( close ).toHaveAttribute( 'aria-label', 'Dismiss' );
		await expect( close ).toBeFocused();

		await page.goBack();
		const again = await openPanel( page, editor, 'Accessibility' );
		await again
			.getByRole( 'button', { name: 'Reset to defaults' } )
			.click();
		await expect( again.locator( '.modal-kit-override-dot' ) ).toHaveCount(
			0
		);
	} );

	test( 'overlay: Styles tab, theme or custom color', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page, { title: 'Overlay' } );
		await page.evaluate( () => {
			const { select, dispatch } = window.wp.data;
			const [ modal ] = select( 'core/block-editor' ).getBlockOrder();
			dispatch( 'core/block-editor' ).selectBlock( modal );
		} );
		await editor.openDocumentSettingsSidebar();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
		await sidebar.getByRole( 'tab', { name: 'Styles' } ).click();
		await expect(
			sidebar.getByRole( 'button', { name: 'Overlay', exact: true } )
		).toBeVisible();

		const overlay = async () =>
			( await editor.getBlocks() )[ 0 ].attributes.overlay ?? {};

		// A theme color is kept as its slug.
		await sidebar
			.getByRole( 'button', { name: 'Overlay color: text color' } )
			.click();
		const popover = page.locator( '.modal-kit-overlay-color__popover' );
		await expect( popover ).toContainText( 'Theme' );
		await popover.getByRole( 'option' ).first().click();
		expect( ( await overlay() ).color ).not.toBe( '' );
		expect( ( await overlay() ).customColor ).toBe( '' );

		// A custom color is kept as its value, and printed on the modal.
		await popover
			.getByRole( 'button', { name: 'Custom color picker' } )
			.click();
		const hex = page.getByRole( 'textbox', { name: 'Hex color' } );
		await hex.fill( '1a2b3c' );
		await hex.press( 'Enter' );
		await expect
			.poll( async () => ( await overlay() ).customColor )
			.toMatch( /^#1a2b3c/i );
		expect( ( await overlay() ).color ).toBe( '' );
		await expect(
			editor.canvas.locator( '.modal-kit.is-editor-preview' )
		).toHaveAttribute( 'style', /--modal-kit-overlay-color:\s*#1a2b3c/i );
	} );
} );

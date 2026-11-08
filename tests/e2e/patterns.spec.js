/**
 * Starter patterns and the picker (mockup 1h): each pattern inserts cleanly,
 * with valid blocks and no hard-coded colors, in Twenty Twenty-Five and Ollie.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { deleteAllModals } = require( './utils/modals' );

const PATTERNS = [
	[ 'Monthly letter', 'centered' ],
	[ 'Discount code', 'split' ],
	[ 'Shipping notice', 'bar' ],
	[ 'Parting gift', 'full' ],
	[ 'Product drop', 'corner' ],
	[ 'Event announcement', 'drawer' ],
	[ 'Video tour', 'video' ],
];

const HARD_CODED_COLOR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i;

/**
 * Every block in the editor, flattened, with its validity.
 *
 * @param {Object} page Playwright page.
 * @return {Promise<Object[]>} Blocks.
 */
function allBlocks( page ) {
	return page.evaluate( () => {
		const flat = [];
		const walk = ( blocks ) =>
			blocks.forEach( ( block ) => {
				flat.push( {
					name: block.name,
					isValid: block.isValid,
					attributes: block.attributes,
				} );
				walk( block.innerBlocks );
			} );
		walk( window.wp.data.select( 'core/block-editor' ).getBlocks() );
		return flat;
	} );
}

for ( const theme of [ 'twentytwentyfive', 'ollie' ] ) {
	test.describe( `Starter patterns (${ theme })`, () => {
		test.beforeAll( async ( { requestUtils } ) => {
			await requestUtils.activateTheme( theme );
		} );

		test.afterAll( async ( { requestUtils } ) => {
			await deleteAllModals( requestUtils );
			await requestUtils.activateTheme( 'twentytwentyfive' );
		} );

		for ( const [ title, layout ] of PATTERNS ) {
			test( `${ title } inserts cleanly`, async ( {
				admin,
				editor,
				page,
			} ) => {
				await admin.createNewPost( { postType: 'mk_modal' } );

				const picker = page.getByRole( 'dialog', {
					name: 'Choose a starting layout',
				} );
				await expect( picker ).toBeVisible();
				await picker.getByRole( 'button', { name: title } ).click();
				await picker
					.getByRole( 'button', { name: `Use “${ title }”` } )
					.click();
				await expect( picker ).toBeHidden();

				const blocks = await allBlocks( page );
				expect( blocks[ 0 ].name ).toBe( 'modal-kit/modal' );
				expect( blocks[ 0 ].attributes.modalLayout ).toBe( layout );
				expect( blocks[ 0 ].attributes.lock ).toEqual( {
					move: true,
					remove: true,
				} );
				expect( blocks.filter( ( block ) => ! block.isValid ) ).toEqual(
					[]
				);

				const content = await editor.getEditedPostContent();
				expect( content ).not.toMatch( HARD_CODED_COLOR );

				// Every preset color slug used exists in the theme.
				const slugs = await page.evaluate( () =>
					window.wp.data
						.select( 'core/block-editor' )
						.getSettings()
						.colors.map( ( color ) => color.slug )
				);
				for ( const block of blocks ) {
					for ( const key of [ 'backgroundColor', 'textColor' ] ) {
						if ( block.attributes[ key ] ) {
							expect( slugs ).toContain(
								block.attributes[ key ]
							);
						}
					}
				}

				expect(
					await page.evaluate( () =>
						window.wp.data
							.select( 'core/editor' )
							.getEditedPostAttribute( 'title' )
					)
				).toBe( title );

				// Publish and open it on the front end.
				const postId = await editor.publishPost();
				const slug = await page.evaluate( () =>
					window.wp.data
						.select( 'core/editor' )
						.getEditedPostAttribute( 'slug' )
				);
				await page.goto( `/?modal=${ slug }` );
				const dialog = page.locator( `#modal-${ slug }` );
				await expect( dialog ).toHaveClass(
					new RegExp( `modal-kit--${ layout }` )
				);
				await expect(
					dialog.locator( '.modal-kit__panel' )
				).toBeVisible();
				expect(
					await dialog.evaluate( ( el ) => el.outerHTML )
				).not.toMatch( /style="[^"]*(#[0-9a-f]{3,8}|rgba?\()/i );
				expect( postId ).toBeTruthy();
			} );
		}
	} );
}

test.describe( 'Pattern picker', () => {
	test( 'filters by category, layout and search', async ( {
		admin,
		page,
	} ) => {
		await admin.createNewPost( { postType: 'mk_modal' } );
		const picker = page.getByRole( 'dialog', {
			name: 'Choose a starting layout',
		} );
		const cards = picker
			.getByRole( 'list', { name: 'Starters' } )
			.getByRole( 'listitem' );

		await expect( cards ).toHaveCount( 7 );

		await picker
			.getByRole( 'button', { name: /^Promo & discount/ } )
			.click();
		await expect( cards ).toHaveCount( 2 );

		await picker.getByRole( 'button', { name: /^All\s*7$/ } ).click();
		await picker
			.getByRole( 'button', { name: 'Drawer', exact: true } )
			.click();
		await expect( cards ).toHaveCount( 1 );
		await expect( cards.first() ).toContainText( 'Event announcement' );

		await picker.getByRole( 'button', { name: 'All layouts' } ).click();
		await picker
			.getByRole( 'searchbox', { name: 'Search patterns' } )
			.fill( 'coupon' );
		await expect( cards ).toHaveCount( 1 );
		await expect( cards.first() ).toContainText( 'Discount code' );
	} );

	test( 'Start blank keeps the default modal', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { postType: 'mk_modal' } );
		await page.getByRole( 'button', { name: 'Start blank' } ).click();

		await expect(
			page.getByRole( 'dialog', { name: 'Choose a starting layout' } )
		).toBeHidden();

		const [ block ] = await editor.getBlocks();
		expect( block.name ).toBe( 'modal-kit/modal' );
		expect( block.attributes.modalLayout ).toBe( 'centered' );
	} );

	test( 'Change template replaces the content after confirming, and undoes', async ( {
		admin,
		editor,
		page,
		pageUtils,
	} ) => {
		await admin.createNewPost( { postType: 'mk_modal', title: 'Spring' } );
		await page.getByRole( 'button', { name: 'Start blank' } ).click();

		// Something of the user's own, then select the Modal block.
		await editor.canvas.locator( '.modal-kit__panel p' ).first().click();
		await page.keyboard.type( 'My own words' );
		await page.evaluate( () => {
			const { select, dispatch } = window.wp.data;
			const [ modal ] = select( 'core/block-editor' ).getBlockOrder();
			dispatch( 'core/block-editor' ).selectBlock( modal );
		} );
		await editor.showBlockToolbar();
		await page
			.getByRole( 'toolbar', { name: 'Block tools' } )
			.getByRole( 'button', { name: 'Change template' } )
			.click();

		const picker = page.getByRole( 'dialog', { name: 'Change template' } );
		await picker
			.getByRole( 'list', { name: 'Starters' } )
			.getByRole( 'button', { name: /Discount code/ } )
			.first()
			.click();
		await picker
			.getByRole( 'button', { name: 'Use “Discount code”' } )
			.click();

		// Asked first; cancelling goes back to the picker.
		const confirm = page.getByRole( 'dialog', {
			name: 'Replace this modal with “Discount code”?',
		} );
		await expect( confirm ).toContainText( 'stay as they are' );
		await confirm.getByRole( 'button', { name: 'Cancel' } ).click();
		await picker
			.getByRole( 'button', { name: 'Use “Discount code”' } )
			.click();
		await confirm
			.getByRole( 'button', { name: 'Replace content' } )
			.click();
		await expect( confirm ).toBeHidden();

		let [ block ] = await editor.getBlocks();
		expect( block.attributes.modalLayout ).toBe( 'split' );
		expect( JSON.stringify( block ) ).not.toContain( 'My own words' );
		expect(
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/editor' )
					.getEditedPostAttribute( 'title' )
			)
		).toBe( 'Spring' );

		// One undo brings the old content back.
		await pageUtils.pressKeys( 'primary+z' );
		[ block ] = await editor.getBlocks();
		expect( block.attributes.modalLayout ).toBe( 'centered' );
		expect( JSON.stringify( block ) ).toContain( 'My own words' );
	} );
} );

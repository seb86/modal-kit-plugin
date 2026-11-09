/**
 * Right-to-left sites. A cookie makes the test site right-to-left (see
 * tests/e2e/mu-plugins/modal-kit-e2e.php), as a language pack would.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	freshStorage,
} = require( './utils/modals' );

// `side` is where the panel lands: positions are physical on every site.
// Right to left changes how text reads, not the side chosen.
const LAYOUTS = {
	centered: {},
	'drawer, right': {
		modalLayout: 'drawer',
		position: 'right',
		side: 'right',
	},
	'drawer, left': {
		modalLayout: 'drawer',
		position: 'left',
		side: 'left',
	},
	sheet: { modalLayout: 'sheet' },
	full: { modalLayout: 'full' },
	'split, media left': { modalLayout: 'split', position: 'media-left' },
	'split, media right': { modalLayout: 'split', position: 'media-right' },
	'corner, bottom right': {
		modalLayout: 'corner',
		position: 'bottom-right',
		side: 'right',
	},
	'corner, bottom left': {
		modalLayout: 'corner',
		position: 'bottom-left',
		side: 'left',
	},
	'bar, bottom': { modalLayout: 'bar', position: 'bottom' },
};

let pageUrl;

test.describe( 'Right to left', () => {
	test.use( {
		contextOptions: {
			reducedMotion: 'no-preference',
			strictSelectors: true,
		},
	} );

	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
		const created = await requestUtils.createPage( {
			title: 'RTL test',
			status: 'publish',
			content:
				'<!-- wp:paragraph --><p><a href="#modal-rtl">Open the modal</a></p><!-- /wp:paragraph -->',
		} );
		pageUrl = new URL( created.link ).pathname;
	} );

	test.beforeEach( async ( { page, context } ) => {
		await freshStorage( page );
		await context.addCookies( [
			{
				name: 'modal_kit_e2e_rtl',
				value: '1',
				url: process.env.WP_BASE_URL,
			},
		] );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllPages();
	} );

	test( 'the page is right to left, with the mirrored stylesheet', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, { slug: 'rtl' } );
		await page.goto( pageUrl );

		await expect( page.locator( 'html' ) ).toHaveAttribute( 'dir', 'rtl' );
		expect(
			await page.evaluate( () =>
				[ ...document.styleSheets ].some( ( sheet ) =>
					/modal-kit.*style-index-rtl/.test( sheet.href ?? '' )
				)
			)
		).toBe( true );
	} );

	// Editor = front end.
	test( 'the editor shows a split modal the same way', async ( {
		admin,
		editor,
		requestUtils,
		page,
		isMobile,
	} ) => {
		test.skip( isMobile, 'The editor is a desktop screen here.' );

		const modal = await createModal( requestUtils, {
			slug: 'rtl',
			attributes: { modalLayout: 'split', position: 'media-left' },
		} );
		await admin.visitAdminPage(
			'post.php',
			`post=${ modal.id }&action=edit`
		);
		await editor.setPreferences( 'core/edit-post', {
			welcomeGuide: false,
		} );

		const block = editor.canvas.locator( '[data-type="modal-kit/modal"]' );
		const heading = block.locator( 'h2' );
		await heading.waitFor();

		// Styles settle once the canvas has loaded them.
		await page.waitForTimeout( 500 );

		const media = await block.locator( '.wp-block-cover' ).boundingBox();
		const text = await heading.boundingBox();

		expect(
			media.x + media.width <= text.x + 1,
			'media on the left, text on the right'
		).toBe( true );
	} );

	for ( const [ name, { side, ...attributes } ] of Object.entries(
		LAYOUTS
	) ) {
		test( `${ name }: fits the screen, with the close button on the reading side`, async ( {
			page,
			requestUtils,
			isMobile,
		} ) => {
			await createModal( requestUtils, { slug: 'rtl', attributes } );
			await page.goto( pageUrl );
			await page.waitForFunction( () =>
				document.documentElement.classList.contains( 'modal-kit-js' )
			);
			await page.getByRole( 'link', { name: 'Open the modal' } ).click();

			const dialog = page.locator( '#modal-rtl' );
			await expect( dialog ).toBeVisible();

			// After any entrance animation.
			await page.waitForTimeout( 700 );

			const panel = await dialog
				.locator( '.modal-kit__panel' )
				.boundingBox();
			const viewport = page.viewportSize();
			expect( panel.x ).toBeGreaterThanOrEqual( -1 );
			expect( panel.x + panel.width ).toBeLessThanOrEqual(
				viewport.width + 1
			);
			expect(
				await page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						window.innerWidth
				),
				'no sideways scroll'
			).toBe( true );

			expect(
				await dialog
					.getByRole( 'heading' )
					.evaluate(
						( node ) =>
							node.ownerDocument.defaultView.getComputedStyle(
								node
							).direction
					)
			).toBe( 'rtl' );

			const close = await dialog
				.getByRole( 'button', { name: 'Close' } )
				.boundingBox();
			expect( close.x + close.width / 2 ).toBeLessThan(
				panel.x + panel.width / 2
			);

			// Phones centre a corner and stack a split, by design.
			if ( side && ! isMobile ) {
				const centre = panel.x + panel.width / 2;
				expect( centre < viewport.width / 2 ? 'left' : 'right' ).toBe(
					side
				);
			}

			// Split: the text beside the media, not on it, and the media where it was put.
			if ( attributes.modalLayout === 'split' && ! isMobile ) {
				const media = await dialog
					.locator( '.modal-kit__panel > :first-child' )
					.boundingBox();
				const text = await dialog.getByRole( 'heading' ).boundingBox();
				const mediaOnRight =
					media.x + media.width / 2 > panel.x + panel.width / 2;

				expect( mediaOnRight ).toBe(
					attributes.position === 'media-right'
				);
				expect(
					mediaOnRight
						? text.x + text.width <= media.x + 1
						: text.x >= media.x + media.width - 1,
					'the text is beside the media'
				).toBe( true );
			}

			await dialog.getByRole( 'button', { name: 'Close' } ).click();
			await expect( dialog ).toBeHidden();
		} );
	}
} );

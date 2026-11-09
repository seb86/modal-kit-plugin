/**
 * Fixed styles: Fieldnote, Harbor and Night look
 * the same in every theme. Each style is checked in all 8 layouts at desktop
 * and 375px in Twenty Twenty-Five, Ollie and a classic theme (Twenty
 * Twenty-One): a visual baseline of the panel, plus computed styles that would change if
 * a theme's button, heading or field rules leaked into the panel.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	newBlankModal,
} = require( './utils/modals' );

const STYLES = {
	fieldnote: {
		surface: 'rgb(255, 255, 255)',
		accent: 'rgb(94, 69, 205)',
		onAccent: 'rgb(255, 255, 255)',
		radius: '8px',
		head: 'Instrument Sans',
		headWeight: '600',
	},
	harbor: {
		surface: 'rgb(251, 250, 246)',
		accent: 'rgb(0, 120, 75)',
		onAccent: 'rgb(255, 255, 255)',
		radius: '2px',
		head: 'Instrument Serif',
		headWeight: '400',
	},
	night: {
		surface: 'rgb(34, 31, 44)',
		accent: 'rgb(236, 168, 81)',
		onAccent: 'rgb(23, 21, 31)',
		radius: '999px',
		head: 'Instrument Sans',
		headWeight: '700',
	},
};

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

const THEMES = [ 'twentytwentyfive', 'ollie', 'twentytwentyone' ];

const INNER = `<!-- wp:paragraph {"style":{"typography":{"textTransform":"uppercase","letterSpacing":"0.08em"}},"fontSize":"small"} -->
<p class="has-small-font-size" style="text-transform:uppercase;letter-spacing:0.08em">Autumn sale · ends Sunday</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2 class="wp-block-heading">20% off every notebook and pen.</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Join the list and we’ll email the code.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Get the code</a></div>
<!-- /wp:button -->

<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button">No thanks</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;

const MEDIA = `<!-- wp:cover {"dimRatio":100,"overlayColor":"black","isUserOverlayColor":true,"minHeight":240,"layout":{"type":"constrained"}} -->
<div class="wp-block-cover" style="min-height:240px"><span aria-hidden="true" class="wp-block-cover__background has-black-background-color has-background-dim-100 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:paragraph -->
<p></p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:cover -->`;

/**
 * Opens a sample modal on the front end, with its fonts loaded.
 *
 * @param {Object} page   Playwright page.
 * @param {string} style  Style slug.
 * @param {string} layout Layout.
 * @return {Promise<Object>} The dialog locator.
 */
async function openSample( page, style, layout ) {
	await page.goto( `/?modal=style-${ style }-${ layout }` );
	const dialog = page.locator( `#modal-style-${ style }-${ layout }` );

	await expect( dialog ).toHaveAttribute( 'open', '' );
	await expect( dialog.locator( '.modal-kit__panel' ) ).toBeVisible();
	await page.evaluate( () => document.fonts.ready );
	await page.waitForTimeout( 500 ); // Opening animation.

	return dialog;
}

test.describe( 'Fixed styles', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );

		for ( const style of Object.keys( STYLES ) ) {
			for ( const [ layout, position ] of LAYOUTS ) {
				await createModal( requestUtils, {
					slug: `style-${ style }-${ layout }`,
					attributes: {
						modalLayout: layout,
						className: `is-style-${ style }`,
						...( position ? { position } : {} ),
					},
					inner: ( layout === 'split' ? MEDIA : '' ) + INNER,
				} );
			}
		}
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.activateTheme( 'twentytwentyfive' );
		await deleteAllModals( requestUtils );
	} );

	for ( const theme of THEMES ) {
		test.describe( theme, () => {
			test.beforeAll( async ( { requestUtils } ) => {
				await requestUtils.activateTheme( theme );
			} );

			for ( const [ style, expected ] of Object.entries( STYLES ) ) {
				test( `${ style } keeps its look`, async ( { page } ) => {
					await page.setViewportSize( VIEWPORTS.desktop );
					const dialog = await openSample( page, style, 'centered' );

					const look = await dialog.evaluate( ( node ) => {
						const css = ( selector ) =>
							window.getComputedStyle(
								node.querySelector( selector )
							);
						const panel = css( '.modal-kit__panel' );
						const heading = css( 'h2' );
						const button = css(
							'.wp-block-button:not(.is-style-outline) .wp-block-button__link'
						);
						const outline = css(
							'.is-style-outline .wp-block-button__link'
						);

						return {
							surface: panel.backgroundColor,
							panelFont: panel.fontFamily,
							head: heading.fontFamily,
							headWeight: heading.fontWeight,
							headMargin: heading.marginBlockEnd,
							button: button.backgroundColor,
							onButton: button.color,
							radius: button.borderTopLeftRadius,
							height: parseFloat( button.minHeight ),
							buttonSize: button.fontSize,
							buttonTransform: button.textTransform,
							outlineBackground: outline.backgroundColor,
							outlineBorder: outline.borderTopWidth,
							outlineRing: outline.outlineStyle,
							actionGap: css( '.wp-block-buttons' ).columnGap,
						};
					} );

					expect( look ).toMatchObject( {
						surface: expected.surface,
						headWeight: expected.headWeight,
						headMargin: '0px',
						button: expected.accent,
						onButton: expected.onAccent,
						radius: expected.radius,
						height: 46,
						buttonSize: '15px',
						buttonTransform: 'none',
						outlineBackground: 'rgba(0, 0, 0, 0)',
						outlineBorder: '1px',
						outlineRing: 'none',
						actionGap: '8px',
					} );
					expect( look.head ).toContain( expected.head );
					expect( look.panelFont ).toContain( 'Instrument Sans' );
				} );

				for ( const [ viewportName, viewport ] of Object.entries(
					VIEWPORTS
				) ) {
					test( `${ style } in every layout (${ viewportName })`, async ( {
						page,
					} ) => {
						await page.setViewportSize( viewport );

						for ( const [ layout ] of LAYOUTS ) {
							const dialog = await openSample(
								page,
								style,
								layout
							);

							// The panel only: the page behind depends on what
							// other suites left (menus, pages), and placement is
							// covered by layouts.spec.js.
							const panel = dialog.locator( '.modal-kit__panel' );

							// An inline panel sits in the page's flow, so what's
							// above it sets its top. A fractional top makes the
							// screenshot a pixel taller or shorter, so put it on a
							// whole pixel.
							if ( layout === 'inline' ) {
								await panel.evaluate( ( node ) => {
									const { top } =
										node.getBoundingClientRect();
									const margin = parseFloat(
										window.getComputedStyle( node )
											.marginTop
									);

									node.style.marginTop = `${
										margin + Math.ceil( top ) - top
									}px`;
								} );
							}

							await expect
								.soft( panel )
								.toHaveScreenshot(
									`${ theme }-${ style }-${ layout }-${ viewportName }.png`,
									{ maxDiffPixelRatio: 0.02 }
								);
						}
					} );
				}
			}
		} );
	}

	test( 'the bundled fonts load only with a fixed style that uses them', async ( {
		page,
		requestUtils,
	} ) => {
		await requestUtils.activateTheme( 'twentytwentyfive' );
		await createModal( requestUtils, {
			slug: 'style-theme-fonts',
			attributes: {
				className: 'is-style-harbor',
				styleOptions: {
					accent: 'style',
					accentColor: '',
					fonts: 'theme',
				},
			},
		} );

		await page.goto( '/?modal=style-theme-fonts' );
		const dialog = page.locator( '#modal-style-theme-fonts' );
		await expect( dialog ).toHaveClass( /mk-fonts-theme/ );
		const head = await dialog
			.locator( 'h2' )
			.evaluate( ( node ) => window.getComputedStyle( node ).fontFamily );
		expect( head ).not.toContain( 'Instrument' );

		await page.goto( '/?modal=style-night-centered' );
		await expect( page.locator( 'link#modal-kit-fonts-css' ) ).toHaveCount(
			1
		);
	} );

	test( 'the editor offers Accent and Fonts for a fixed style', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await requestUtils.activateTheme( 'twentytwentyfive' );
		await newBlankModal( admin, page, { title: 'Styled' } );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		const container = canvas.locator( '.modal-kit.is-editor-preview' );

		await editor.selectBlocks( container );
		await editor.openDocumentSettingsSidebar();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
		await sidebar.getByRole( 'tab', { name: 'Styles' } ).click();

		await expect(
			sidebar.getByRole( 'radiogroup', { name: 'Accent' } )
		).toHaveCount( 0 );

		await sidebar.getByRole( 'radio', { name: 'Night' } ).click();
		await expect( container ).toHaveClass( /mk-style-night/ );

		const accent = sidebar.getByRole( 'radiogroup', { name: 'Accent' } );
		await accent.getByRole( 'radio', { name: 'Custom' } ).click();
		await expect( container ).toHaveAttribute(
			'style',
			/--mk-accent: #eca851/
		);

		// A dark accent is unreadable as text on Night's dark panel.
		await sidebar
			.getByRole( 'button', { name: 'Custom color picker' } )
			.click();
		await page
			.getByRole( 'textbox', { name: 'Hex color' } )
			.fill( '333333' );
		await expect(
			sidebar.getByText( /This accent is hard to read/ )
		).toBeVisible();

		await sidebar
			.getByRole( 'radiogroup', { name: 'Fonts' } )
			.getByRole( 'radio', { name: 'Theme fonts' } )
			.click();
		await expect( container ).toHaveClass( /mk-fonts-theme/ );

		const [ block ] = await editor.getBlocks();
		expect( block.attributes.className ).toBe( 'is-style-night' );
		expect( block.attributes.styleOptions ).toEqual( {
			accent: 'custom',
			accentColor: '#333333',
			fonts: 'theme',
		} );
	} );

	test( 'the default style from Settings reaches new modals, also from a starter', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await requestUtils.activateTheme( 'twentytwentyfive' );
		await admin.visitAdminPage(
			'edit.php',
			'post_type=mk_modal&page=modal-kit-settings#display'
		);

		await expect( page.locator( '#modal-kit-style' ) ).toBeVisible();
		await page.locator( '#modal-kit-style' ).click();
		await page.getByRole( 'menuitemradio', { name: 'Harbor' } ).click();
		await expect( page.locator( '#modal-kit-style' ) ).toHaveText(
			/Harbor/
		);

		// Reopened, the menu focuses the chosen style, like a select.
		await page.locator( '#modal-kit-style' ).click();
		await expect(
			page.getByRole( 'menuitemradio', { name: 'Harbor' } )
		).toBeFocused();
		await page.keyboard.press( 'Escape' );

		await page
			.getByRole( 'radiogroup', { name: 'Fonts' } )
			.getByRole( 'radio', { name: 'Theme fonts' } )
			.click();
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		await expect(
			page
				.locator( '.modal-kit-settings__notice' )
				.getByText( 'Settings saved.' )
		).toBeVisible();

		await admin.createNewPost( { postType: 'mk_modal' } );
		const picker = page.getByRole( 'dialog', {
			name: 'Choose a starting layout',
		} );
		const card = picker.getByRole( 'button', { name: 'Monthly letter' } );

		// The cards already show the default style, before one is chosen.
		await expect(
			card
				.locator( 'iframe' )
				.contentFrame()
				.locator( '.mk-style-harbor' )
		).toBeAttached();

		await card.click();
		await picker
			.getByRole( 'button', { name: 'Use “Monthly letter”' } )
			.click();
		await expect( picker ).toBeHidden();

		const [ block ] = await editor.getBlocks();
		expect( block.attributes.className ).toContain( 'is-style-harbor' );
		expect( block.attributes.styleOptions ).toMatchObject( {
			fonts: 'theme',
		} );

		await requestUtils.rest( {
			path: '/wp/v2/settings',
			method: 'POST',
			data: {
				modal_kit_display: {
					...(
						await requestUtils.rest( { path: '/wp/v2/settings' } )
					).modal_kit_display,
					defaultStyle: 'default',
					defaultFonts: 'style',
				},
			},
		} );
	} );
} );

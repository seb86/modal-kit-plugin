/**
 * Fixed styles look the same in every theme: each theme is compared with the
 * reference theme, by screenshot and by computed style. Theme-native follows
 * the theme by design, so it only has to stay usable.
 *
 * Run through `npm run test:themes` (bin/test-themes.mjs), which makes the
 * reference first and whose global setup makes the modals.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const { LAYOUTS, PREFIX, STYLES } = require( './fixtures' );
const { readLook } = require( './look' );

const THEMES = ( process.env.MODAL_KIT_THEMES || '' )
	.split( ',' )
	.filter( Boolean );

const SHOTS = path.join( __dirname, '../../artifacts/themes/shots' );

const VIEWPORTS = {
	desktop: { width: 1280, height: 800 },
	mobile: { width: 375, height: 740 },
};

// An inline panel sits in the theme's column, and how wide that is belongs to
// the theme. Pinning it compares everything else.
const INLINE_WIDTH = { desktop: 520, mobile: 320 };

// Only the panel is compared, but the theme's page shows through its rounded
// corners and fractional edges, so that's cleared. Settled states need no
// transitions either.
const PAGE_RESET = `
*, *::before, *::after { transition: none !important; }
html, body { background: #fff !important; }
body *:not(:has(.modal-kit__panel), .modal-kit__panel, .modal-kit__panel *) { visibility: hidden !important; }
`;

/**
 * Opens a modal on the front end, settled, with its fonts loaded.
 *
 * @param {Object} page Playwright page.
 * @param {string} slug Modal slug, without the prefix.
 * @return {Promise<Object>} The dialog locator.
 */
async function open( page, slug ) {
	await page.goto( `/?modal=${ PREFIX }${ slug }` );

	const dialog = page.locator( `#modal-${ PREFIX }${ slug }` );

	await expect(
		dialog,
		'The modal did not open. Another test suite may be using this site, or its script may have failed to load.'
	).toHaveAttribute( 'open', '' );
	await expect( dialog.locator( '.modal-kit__panel' ) ).toBeVisible();
	await page.addStyleTag( { content: PAGE_RESET } );
	await page.evaluate( () => document.fonts.ready );
	await page.waitForTimeout( 400 ); // Opening animation.

	return dialog;
}

/**
 * Gives an inline panel a fixed width on whole pixels, so only the look is left
 * to compare, not where the theme's column puts it.
 *
 * @param {Object} panel Panel locator.
 * @param {number} width Width in pixels.
 * @return {Promise<void>}
 */
function pinInline( panel, width ) {
	return panel.evaluate( ( node, pinned ) => {
		node.style.width = `${ pinned }px`;
		node.style.maxWidth = 'none';

		const { left, top } = node.getBoundingClientRect();
		const { marginLeft, marginTop } = window.getComputedStyle( node );

		// Margins, not a transform: text settles on different pixels in one.
		node.style.marginLeft = `${
			parseFloat( marginLeft ) + Math.ceil( left ) - left
		}px`;
		node.style.marginTop = `${
			parseFloat( marginTop ) + Math.ceil( top ) - top
		}px`;
	}, width );
}

/**
 * Compares a panel with the reference and keeps the screenshot for the report.
 *
 * @param {Object} panel Panel locator.
 * @param {string} theme Theme slug.
 * @param {string} name  Screenshot name, without the extension.
 * @return {Promise<void>}
 */
async function compare( panel, theme, name ) {
	const file = path.join( SHOTS, theme, `${ name }.png` );

	fs.mkdirSync( path.dirname( file ), { recursive: true } );

	const shot = await panel.screenshot( {
		animations: 'disabled',
		path: file,
	} );

	expect.soft( shot ).toMatchSnapshot( `${ name }.png`, {
		maxDiffPixelRatio: 0.002,
	} );
}

test.describe( 'Themes', () => {
	for ( const theme of THEMES ) {
		test.describe( theme, () => {
			test.beforeAll( async ( { requestUtils } ) => {
				await requestUtils.activateTheme( theme );
			} );

			for ( const style of STYLES ) {
				for ( const [ viewportName, viewport ] of Object.entries(
					VIEWPORTS
				) ) {
					test( `${ style } in every layout (${ viewportName })`, async ( {
						page,
					} ) => {
						await page.setViewportSize( viewport );

						for ( const [ layout ] of LAYOUTS ) {
							const dialog = await open(
								page,
								`${ style }-${ layout }`
							);
							const panel = dialog.locator( '.modal-kit__panel' );

							if ( layout === 'inline' ) {
								await pinInline(
									panel,
									INLINE_WIDTH[ viewportName ]
								);
							}

							await compare(
								panel,
								theme,
								`${ style }-${ layout }-${ viewportName }`
							);
						}
					} );

					test( `${ style } with core blocks (${ viewportName })`, async ( {
						page,
					} ) => {
						await page.setViewportSize( viewport );

						const dialog = await open( page, `${ style }-rich` );

						await compare(
							dialog.locator( '.modal-kit__panel' ),
							theme,
							`${ style }-rich-${ viewportName }`
						);

						expect
							.soft( await readLook( page, dialog ) )
							.toMatchSnapshot(
								`${ style }-look-${ viewportName }.txt`
							);
					} );
				}
			}

			for ( const [ viewportName, viewport ] of Object.entries(
				VIEWPORTS
			) ) {
				test( `Theme-native stays usable (${ viewportName })`, async ( {
					page,
				} ) => {
					await page.setViewportSize( viewport );

					const dialog = await open( page, 'native' );
					const panel = dialog.locator( '.modal-kit__panel' );

					await expect.soft( dialog.locator( 'h2' ) ).toBeFocused();

					const close = await dialog
						.locator( '.modal-kit__close' )
						.boundingBox();

					expect.soft( close.width ).toBeGreaterThanOrEqual( 44 );
					expect.soft( close.height ).toBeGreaterThanOrEqual( 44 );

					const box = await panel.boundingBox();

					expect.soft( box.x ).toBeGreaterThanOrEqual( 0 );
					expect.soft( box.y ).toBeGreaterThanOrEqual( 0 );
					expect
						.soft( box.x + box.width )
						.toBeLessThanOrEqual( viewport.width );
					expect
						.soft( box.y + box.height )
						.toBeLessThanOrEqual( viewport.height );

					const controls = dialog.locator( '.wp-block-button__link' );

					for ( const control of await controls.all() ) {
						const { height } = await control.boundingBox();

						expect.soft( height ).toBeGreaterThanOrEqual( 44 );
					}

					await page.keyboard.press( 'Escape' );
					await expect
						.soft( dialog )
						.not.toHaveAttribute( 'open', '' );
				} );
			}
		} );
	}
} );

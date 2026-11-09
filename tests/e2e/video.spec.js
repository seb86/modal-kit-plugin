/**
 * Video: privacy-friendly embeds that load on open, pause on
 * close, and links that play in a lightbox.
 *
 * YouTube is stubbed: oEmbed answers come from the e2e mu-plugin, and the
 * player page is served by Playwright. The fake player echoes every API
 * command back to the page, so tests can check what was sent.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const {
	createModal,
	deleteAllModals,
	freshStorage,
	newBlankModal,
} = require( './utils/modals' );

const EMBED = `<!-- wp:embed {"url":"https://www.youtube.com/watch?v=tour123","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper">
https://www.youtube.com/watch?v=tour123
</div></figure>
<!-- /wp:embed -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">The three-minute tour</h3>
<!-- /wp:heading -->`;

const FAKE_PLAYER = `<!doctype html><title>player</title><script>
window.addEventListener( 'message', ( e ) => {
	window.parent.postMessage( { echo: e.data, src: location.href }, '*' );
} );
window.parent.postMessage( { loaded: location.href }, '*' );
</script>`;

/**
 * Serves the fake player and records what it receives.
 *
 * @param {Object} page Playwright page.
 */
async function stubPlayer( page ) {
	await page.route( /youtube(-nocookie)?\.com\/embed\//, ( route ) =>
		route.fulfill( { contentType: 'text/html', body: FAKE_PLAYER } )
	);
	await page.addInitScript( () => {
		window.__mkPlayer = [];
		window.addEventListener( 'message', ( event ) => {
			if ( event.data?.echo || event.data?.loaded ) {
				window.__mkPlayer.push( event.data );
			}
		} );
	} );
}

const received = ( page ) => page.evaluate( () => window.__mkPlayer );

test.describe( 'Video', () => {
	test.beforeEach( async ( { page } ) => {
		await freshStorage( page );
		await stubPlayer( page );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await deleteAllModals( requestUtils );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllPages();
	} );

	test( 'embeds wait for a click, use youtube-nocookie and pause on close', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'tour',
			attributes: { modalLayout: 'video' },
			inner: EMBED,
		} );

		await page.goto( '/' );
		const iframe = page.locator( '#modal-tour iframe' );

		// Nothing loads with the page.
		await expect( iframe ).not.toHaveAttribute( 'src', /.+/ );
		await expect( iframe ).toHaveAttribute(
			'data-modal-kit-src',
			/^https:\/\/www\.youtube-nocookie\.com\/embed\/tour123\?.*enablejsapi=1/
		);

		await page.goto( '/?modal=tour' );
		const dialog = page.locator( '#modal-tour' );
		await expect( dialog ).toBeVisible();
		await expect( dialog ).toHaveClass( /modal-kit--video/ );
		const consent = dialog.locator( '.modal-kit-consent' );
		await expect( consent ).toContainText(
			'Loads from YouTube, which may set cookies.'
		);
		await expect( iframe ).not.toHaveAttribute( 'src', /.+/ );

		await consent.getByRole( 'button', { name: /Play video/ } ).click();
		await expect( iframe ).toHaveAttribute(
			'src',
			/youtube-nocookie\.com\/embed\/tour123\?.*autoplay=1/
		);
		await expect( consent ).toHaveCount( 0 );
		await expect
			.poll( async () =>
				( await received( page ) ).some( ( m ) => m.loaded )
			)
			.toBe( true );

		// Focus is in the player now (Esc goes to the iframe): use the button.
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
		await expect( dialog ).toBeHidden();
		await expect
			.poll( async () =>
				( await received( page ) ).some(
					( m ) =>
						typeof m.echo === 'string' &&
						m.echo.includes( '"func":"pauseVideo"' )
				)
			)
			.toBe( true );
	} );

	test( 'on a phone the player spans the screen', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'tour',
			attributes: { modalLayout: 'video' },
			// Text after the player, as in the Video tour template.
			inner:
				EMBED +
				'<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">The three-minute tour</p><!-- /wp:paragraph -->',
		} );

		await page.setViewportSize( { width: 390, height: 844 } );
		await page.goto( '/?modal=tour' );
		const player = page.locator( '#modal-tour .wp-block-embed__wrapper' );
		await expect( page.locator( '#modal-tour' ) ).toBeVisible();

		const box = await player.boundingBox();
		expect( box.width ).toBeGreaterThan( 340 );
		expect( Math.round( box.height ) ).toBe(
			Math.round( ( box.width * 9 ) / 16 )
		);
	} );

	test( 'without the click-to-load screen, the embed loads when the modal opens', async ( {
		page,
		requestUtils,
	} ) => {
		await createModal( requestUtils, {
			slug: 'tour',
			attributes: { modalLayout: 'video' },
			inner: EMBED,
			meta: {
				overrides: {
					video: {
						clickToLoad: false,
						nocookie: false,
						aspectRatio: '4:3',
					},
				},
			},
		} );

		await page.goto( '/?modal=tour' );
		const dialog = page.locator( '#modal-tour' );
		await expect( dialog ).toHaveAttribute(
			'style',
			/--modal-kit-video-ratio:4 \/ 3/
		);
		await expect( dialog.locator( 'iframe' ) ).toHaveAttribute(
			'src',
			/^https:\/\/www\.youtube\.com\/embed\/tour123\?/
		);
	} );

	test( 'a link plays in the shared lightbox, and stays a real link', async ( {
		page,
		requestUtils,
	} ) => {
		const created = await requestUtils.createPage( {
			title: 'Tour page',
			status: 'publish',
			content: `<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"modalKitVideoLightbox":true} -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://youtu.be/tour123">Watch the tour</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`,
		} );

		await page.goto( new URL( created.link ).pathname );
		const link = page.getByRole( 'link', { name: 'Watch the tour' } );
		await expect( link ).toHaveAttribute(
			'href',
			'https://youtu.be/tour123'
		);

		await link.click();
		const lightbox = page.locator( '#modal-video-lightbox' );
		await expect( lightbox ).toBeVisible();
		await lightbox.getByRole( 'button', { name: /Play video/ } ).click();
		await expect( lightbox.locator( 'iframe' ) ).toHaveAttribute(
			'src',
			/youtube-nocookie\.com\/embed\/tour123/
		);

		await lightbox.getByRole( 'button', { name: 'Close' } ).click();
		await expect( lightbox ).toBeHidden();
		await expect( lightbox.locator( 'iframe' ) ).toHaveCount( 0 );
		await expect( link ).toBeFocused();
	} );

	test( 'the Video panel appears for modals with video', async ( {
		admin,
		editor,
		page,
	} ) => {
		await newBlankModal( admin, page, { title: 'Video panel' } );
		await editor.openDocumentSettingsSidebar();
		const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
		await sidebar.getByRole( 'tab', { name: 'Modal' } ).click();
		await expect(
			sidebar.getByRole( 'button', { name: 'Video', exact: true } )
		).toHaveCount( 0 );

		await page.evaluate( () => {
			const { createBlock } = window.wp.blocks;
			const { dispatch, select } = window.wp.data;
			const [ modal ] = select( 'core/block-editor' ).getBlocks();
			dispatch( 'core/block-editor' ).insertBlock(
				createBlock( 'core/video' ),
				0,
				modal.clientId
			);
		} );

		// Inserting the block selected it; back to the Modal tab.
		await sidebar.getByRole( 'tab', { name: 'Modal' } ).click();
		const toggle = sidebar.getByRole( 'button', {
			name: 'Video',
			exact: true,
		} );
		await expect( toggle ).toBeVisible();
		if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'false' ) {
			await toggle.click();
		}
		await sidebar
			.getByRole( 'checkbox', { name: 'Close when the video ends' } )
			.check();
		await sidebar.getByRole( 'radio', { name: '9:16' } ).click();

		const meta = await page.evaluate( () =>
			window.wp.data
				.select( 'core/editor' )
				.getEditedPostAttribute( 'meta' )
		);
		expect( meta._modal_kit_overrides.video ).toMatchObject( {
			closeOnEnd: true,
			aspectRatio: '9:16',
		} );
	} );
} );

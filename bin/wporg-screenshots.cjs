/**
 * Captures the WordPress.org screenshots (readme "== Screenshots ==") into
 * .wordpress-org/ from the Laragon test site, with the free plugin only
 * active: `npm run wporg:screenshots`. It creates sample modals from the
 * starter templates and deletes them afterwards.
 */
/* eslint-disable no-console */
const fs = require( 'fs' );
const path = require( 'path' );
const { chromium } = require( 'playwright' );

const BASE = 'http://localhost:8082';
const OUT = path.join( __dirname, '..', '.wordpress-org' );
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const shot = ( n ) => path.join( OUT, `screenshot-${ n }.png` );

async function login( browser ) {
	const context = await browser.newContext( { viewport: DESKTOP } );
	const page = await context.newPage();
	await page.goto( `${ BASE }/wp-login.php` );
	await page.fill( '#user_login', 'admin' );
	await page.fill( '#user_pass', 'password' );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
	return { context, page };
}

async function rest( page, pathname, options = {} ) {
	return page.evaluate(
		async ( request ) => {
			const nonce = await (
				await fetch( '/wp-admin/admin-ajax.php?action=rest-nonce' )
			).text();
			const res = await fetch( '/wp-json' + request.pathname, {
				method: request.options.method ?? 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': nonce,
				},
				body: request.options.data
					? JSON.stringify( request.options.data )
					: undefined,
			} );
			return res.json();
		},
		{ pathname, options }
	);
}

/**
 * Sets attributes on the outer Modal block comment of pattern content.
 *
 * @param {string} content Pattern content.
 * @param {Object} changes Attributes to set.
 * @return {string} Content.
 */
function withAttributes( content, changes ) {
	return content.replace(
		/<!-- wp:modal-kit\/modal( \{.*?\})? -->/,
		( all, json ) => {
			const attrs = { ...( json ? JSON.parse( json ) : {} ), ...changes };
			return `<!-- wp:modal-kit/modal ${ JSON.stringify( attrs ) } -->`;
		}
	);
}

async function openFront( page, slug ) {
	await page.goto( `${ BASE }/?modal=${ slug }` );
	await page.addStyleTag( {
		content: '::-webkit-scrollbar{display:none}html{scrollbar-width:none}',
	} );
	await page
		.locator( `#modal-${ slug }[open]` )
		.waitFor( { timeout: 15000 } );
	await page.waitForTimeout( 1200 );
	// Non-blocking layouts (corner) let the page-load bar open too: close it
	// so each shot shows one modal.
	const others = page.locator(
		`dialog[open]:not(#modal-${ slug }) .modal-kit__close`
	);
	const open = await others.all();
	for ( const close of open ) {
		await close.click();
	}
	if ( open.length ) {
		await page.waitForTimeout( 600 );
	}
}

async function compose( browser, html, size, file ) {
	const page = await browser.newPage( { viewport: size } );
	await page.setContent( html );
	await page.waitForTimeout( 300 );
	await page.screenshot( { path: file } );
	await page.close();
}

const dataUrl = ( buffer ) =>
	`data:image/png;base64,${ buffer.toString( 'base64' ) }`;

// Puts back the pages hidden for the shots and deletes the sample modals,
// even when a shot fails.
let restorePages = async () => {};
let removeModals = async () => {};
let restorePlugins = async () => {};

( async () => {
	const browser = await chromium.launch();
	const { page } = await login( browser );
	await page.evaluate( () => window.localStorage.clear() );

	// Only Modal Kit, as the header says: other plugins on the test site (Simply
	// Static, WooCommerce) would show in the admin bar and menu. They're switched
	// back on at the end.
	const others = (
		await rest( page, '/wp/v2/plugins?status=active&_fields=plugin' )
	)
		.map( ( p ) => p.plugin )
		.filter( ( plugin ) => ! plugin.startsWith( 'modal-kit/' ) );
	const setPlugins = ( status ) =>
		Promise.all(
			others.map( ( plugin ) =>
				rest( page, `/wp/v2/plugins/${ plugin }`, {
					method: 'POST',
					data: { status },
				} )
			)
		);
	await setPlugins( 'inactive' );
	restorePlugins = () => setPlugins( 'active' );

	// Update counts are the test site's, not the product's.
	await page.addInitScript( () =>
		document.addEventListener( 'DOMContentLoaded', () => {
			const style = document.createElement( 'style' );
			style.textContent =
				'#wp-admin-bar-updates, #adminmenu .update-plugins, #adminmenu .awaiting-mod { display: none !important; }';
			document.head.append( style );
		} )
	);

	// The theme's header lists every published page, so test leftovers
	// (static-export fixtures, WooCommerce pages) would show in the shots.
	// Keep only the default Sample Page while capturing.
	const published = await rest(
		page,
		'/wp/v2/pages?status=publish&per_page=100&_fields=id,slug'
	);
	const hidden = published
		.filter( ( p ) => p.slug !== 'sample-page' )
		.map( ( p ) => p.id );
	const setStatus = ( status ) =>
		Promise.all(
			hidden.map( ( id ) =>
				rest( page, `/wp/v2/pages/${ id }`, {
					method: 'POST',
					data: { status },
				} )
			)
		);
	await setStatus( 'draft' );
	restorePages = () => setStatus( 'publish' );

	// Starter templates as published modals, opened by link (?modal=slug).
	const patterns = await rest( page, '/wp/v2/block-patterns/patterns' );
	const content = ( name ) =>
		patterns.find( ( p ) => p.name === `modal-kit/${ name }` ).content;
	const created = [];
	removeModals = async () => {
		for ( const id of created.splice( 0 ) ) {
			await rest( page, `/wp/v2/mk_modal/${ id }?force=true`, {
				method: 'DELETE',
			} );
		}
	};
	const make = async ( slug, title, markup, meta = {} ) => {
		const post = await rest( page, '/wp/v2/mk_modal', {
			method: 'POST',
			data: { slug, title, status: 'publish', content: markup, meta },
		} );
		created.push( post.id );
		return post;
	};

	const LAYOUTS = [
		[ 'centered', 'Monthly letter', content( 'monthly-letter' ) ],
		[ 'split', 'Discount code', content( 'discount-code' ) ],
		[ 'corner', 'Product drop', content( 'product-drop' ) ],
		[ 'bar', 'Shipping notice', content( 'shipping-notice' ) ],
		[ 'drawer', 'Event announcement', content( 'event-announcement' ) ],
		[ 'full', 'Parting gift', content( 'parting-gift' ) ],
		[
			'sheet',
			'Members evening',
			withAttributes( content( 'monthly-letter' ), {
				modalLayout: 'sheet',
			} ),
		],
		[
			'video',
			'Video tour',
			content( 'video-tour' ).replace(
				/<!-- wp:video[\s\S]*?<!-- \/wp:video -->/,
				'<!-- wp:embed {"url":"https://www.youtube.com/watch?v=aqz-KE-bpKQ","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} --><figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper">\nhttps://www.youtube.com/watch?v=aqz-KE-bpKQ\n</div></figure><!-- /wp:embed -->'
			),
		],
	];
	const sample = await rest( page, '/wp/v2/pages?search=Sample&_fields=id' );
	const TRIGGERS = {
		centered: [ { type: 'scroll', percent: 40 } ],
		corner: [ { type: 'time', delay: 30 } ],
		bar: [ { type: 'load', delay: 0 } ],
		drawer: [ { type: 'url', value: 'utm_campaign=workshops' } ],
		full: [ { type: 'exit', touch: 'scroll-up' } ],
		sheet: [ { type: 'inactivity', delay: 20 } ],
		video: [ { type: 'element', anchor: 'tour' } ],
	};
	const slugOf = ( layout ) =>
		LAYOUTS.find( ( l ) => l[ 0 ] === layout )[ 1 ]
			.toLowerCase()
			.replace( /[^a-z0-9]+/g, '-' );
	for ( const [ layout, title, markup ] of LAYOUTS ) {
		await make(
			slugOf( layout ),
			title,
			markup,
			layout === 'split'
				? {
						_modal_kit_triggers: [
							{ type: 'scroll', percent: 50 },
							{ type: 'exit' },
						],
						_modal_kit_rules: {
							showOn: {
								mode: 'include',
								include: [
									'/',
									...( sample[ 0 ]
										? [ `post:${ sample[ 0 ].id }` ]
										: [] ),
								],
								exclude: [],
								postTypes: [],
							},
							frequency: {
								mode: 'days',
								days: 7,
								stopAfterCta: true,
							},
							devices: [ 'desktop', 'tablet', 'mobile' ],
							schedule: { start: '', end: '' },
							visitors: { hideLoggedIn: false, minPageViews: 0 },
						},
					}
				: { _modal_kit_triggers: TRIGGERS[ layout ] }
		);
	}

	// Front-end shots as a visitor (no admin bar).
	const guestDesktop = await browser.newPage( { viewport: DESKTOP } );
	const guestPhone = await browser.newPage( {
		viewport: PHONE,
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
	} );

	// 1. Native centered modal, desktop and phone.
	await openFront( guestDesktop, slugOf( 'centered' ) );
	const desk = await guestDesktop.screenshot();
	await openFront( guestPhone, slugOf( 'centered' ) );
	const phone = await guestPhone.screenshot();
	await compose(
		browser,
		`<body style="margin:0;background:#f0f0f1;display:flex;gap:40px;align-items:center;justify-content:center;height:100vh">
		<img src="${ dataUrl( desk ) }" style="width:960px;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.18)">
		<img src="${ dataUrl( phone ) }" style="height:700px;border-radius:28px;border:8px solid #1e1e1e;box-shadow:0 10px 30px rgba(0,0,0,.18)">
	</body>`,
		{ width: 1600, height: 900 },
		shot( 1 )
	);

	// 2. Every layout.
	const tiles = [];
	for ( const [ layout, title ] of LAYOUTS ) {
		await openFront( guestDesktop, slugOf( layout ) );
		tiles.push( [
			title,
			layout,
			dataUrl( await guestDesktop.screenshot() ),
		] );
	}
	const names = {
		centered: 'Centered',
		split: 'Split',
		corner: 'Corner',
		bar: 'Bar',
		drawer: 'Drawer',
		full: 'Full-screen',
		sheet: 'Bottom sheet',
		video: 'Video lightbox',
	};
	await compose(
		browser,
		`<body style="margin:0;padding:36px;background:#f0f0f1;font:600 18px/1.3 -apple-system,'Segoe UI',sans-serif;color:#1e1e1e">
		<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:28px 24px">
		${ tiles.map( ( [ , layout, src ] ) => `<figure style="margin:0"><img src="${ src }" style="width:100%;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.15)"><figcaption style="margin-top:10px">${ names[ layout ] }</figcaption></figure>` ).join( '' ) }
		</div></body>`,
		{ width: 1600, height: 660 },
		shot( 2 )
	);

	// 3. The editor over the homepage.
	await page.addInitScript( () =>
		window.localStorage.setItem( 'modal-kit:editor-backdrop', 'site' )
	);
	const centered = created[ 0 ];
	await page.goto(
		`${ BASE }/wp-admin/post.php?post=${ centered }&action=edit`
	);
	await page.waitForFunction(
		() =>
			window.wp?.data?.select( 'core/block-editor' )?.getBlockOrder()
				.length > 0,
		null,
		{ timeout: 30000 }
	);
	// Preferences are kept per user, and the Docs screenshots turn fullscreen
	// on: these show the editor in the admin, with the Modal Kit menu.
	await page.evaluate( () => {
		const preferences = window.wp.data.dispatch( 'core/preferences' );
		preferences.set( 'core', 'welcomeGuide', false );
		preferences.set( 'core', 'distractionFree', false );
		preferences.set( 'core/edit-post', 'fullscreenMode', false );
	} );
	await page
		.frameLocator( 'iframe[name="editor-canvas"]' )
		.locator( '.modal-kit.has-homepage' )
		.waitFor( { timeout: 30000 } );
	await page.evaluate( () => {
		const { select, dispatch } = window.wp.data;
		dispatch( 'core/block-editor' ).selectBlock(
			select( 'core/block-editor' ).getBlockOrder()[ 0 ]
		);
	} );
	const sidebar = page.getByRole( 'region', { name: 'Editor settings' } );
	if ( ! ( await sidebar.isVisible().catch( () => false ) ) ) {
		await page
			.getByRole( 'button', { name: 'Settings', exact: true } )
			.click();
	}
	await sidebar.getByRole( 'tab', { name: 'Block' } ).click();
	await page.waitForTimeout( 1200 );
	await page.screenshot( { path: shot( 3 ) } );

	// 4. Triggers and display rules (the split modal), searching a page.
	await page.goto(
		`${ BASE }/wp-admin/post.php?post=${ created[ 1 ] }&action=edit`
	);
	await page.waitForFunction(
		() =>
			window.wp?.data?.select( 'core/block-editor' )?.getBlockOrder()
				.length > 0,
		null,
		{ timeout: 30000 }
	);
	await page.setViewportSize( { width: 1280, height: 1000 } );
	await sidebar.getByRole( 'tab', { name: 'Modal' } ).click();
	// Panels remember whether they're open, per user: another run may have
	// closed these.
	const triggers = sidebar.getByRole( 'button', { name: /^Triggers/ } );
	if ( ( await triggers.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
		await triggers.click();
	}
	const rules = sidebar.getByRole( 'button', { name: 'Display rules' } );
	await rules.scrollIntoViewIfNeeded();
	if ( ( await rules.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
		await rules.click();
	}
	const pages = sidebar.getByRole( 'combobox', {
		name: 'Pages',
		exact: true,
	} );
	await pages.fill( 'Hello' );
	await page
		.getByRole( 'listbox' )
		.getByRole( 'option' )
		.first()
		.waitFor( { timeout: 15000 } )
		.catch( () => {} );
	await page.waitForTimeout( 600 );
	await page.screenshot( { path: shot( 4 ) } );
	await page.keyboard.press( 'Escape' );
	await page.setViewportSize( DESKTOP );

	// 5. Choosing a starting layout.
	await page.goto( `${ BASE }/wp-admin/post-new.php?post_type=mk_modal` );
	await page
		.getByRole( 'dialog', { name: 'Choose a starting layout' } )
		.waitFor();
	await page.waitForTimeout( 3000 );
	await page.screenshot( { path: shot( 5 ) } );

	// 6. The modal list.
	await page.goto( `${ BASE }/wp-admin/edit.php?post_type=mk_modal` );
	const milestone = page
		.locator(
			'.modal-kit-milestone .notice-dismiss, .modal-kit-milestone button'
		)
		.first();
	if ( await milestone.count() ) {
		await milestone.click();
		await page.waitForTimeout( 400 );
	}
	await page.waitForTimeout( 800 );
	await page.screenshot( { path: shot( 6 ) } );

	// 7. Settings → Display with the live preview.
	await page.goto(
		`${ BASE }/wp-admin/edit.php?post_type=mk_modal&page=modal-kit-settings#display`
	);
	await page.locator( '.modal-kit-preview iframe' ).waitFor();
	await page.waitForTimeout( 3000 );
	await page.screenshot( { path: shot( 7 ) } );

	// 8. The video lightbox with the click-to-load screen, on a phone.
	await openFront( guestPhone, slugOf( 'video' ) );
	await guestPhone.waitForTimeout( 800 );
	const video = await guestPhone.screenshot();
	await compose(
		browser,
		`<body style="margin:0;background:#f0f0f1;display:grid;place-items:center;height:100vh">
		<img src="${ dataUrl( video ) }" style="height:820px;border-radius:32px;border:10px solid #1e1e1e;box-shadow:0 10px 30px rgba(0,0,0,.18)">
	</body>`,
		{ width: 1600, height: 900 },
		shot( 8 )
	);

	// 9. The first-run setup.
	await page.goto( `${ BASE }/wp-admin/admin.php?page=modal-kit-setup` );
	await page.locator( '.modal-kit-wizard' ).waitFor();
	await page.waitForTimeout( 800 );
	await page.screenshot( { path: shot( 9 ) } );

	// Clean up.
	await removeModals();
	await restorePages();
	await restorePlugins();
	await browser.close();
	for ( let n = 1; n <= 9; n++ ) {
		console.log(
			`screenshot-${ n }.png`,
			fs.existsSync( shot( n ) )
				? Math.round( fs.statSync( shot( n ) ).size / 1024 ) + ' KB'
				: 'missing'
		);
	}
} )().catch( async ( error ) => {
	console.error( error );
	await removeModals().catch( () => {} );
	await restorePages().catch( () => {} );
	await restorePlugins().catch( () => {} );
	process.exit( 1 );
} );

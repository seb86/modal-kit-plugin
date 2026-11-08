/**
 * The modals the theme comparison opens. They're made once per run and carry a
 * prefix, so only these are ever removed: this may run on someone's own site.
 */
const { request } = require( '@playwright/test' );
const { RequestUtils } = require( '@wordpress/e2e-test-utils-playwright' );
const { createModal } = require( '../e2e/utils/modals' );

const PREFIX = 'mk-themes-';

const STYLES = [ 'fieldnote', 'harbor', 'night' ];

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

const SAMPLE = `<!-- wp:paragraph {"style":{"typography":{"textTransform":"uppercase","letterSpacing":"0.08em"}},"fontSize":"small"} -->
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
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#shop">Get the code</a></div>
<!-- /wp:button -->

<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="#later">No thanks</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;

const MEDIA = `<!-- wp:cover {"dimRatio":100,"overlayColor":"black","isUserOverlayColor":true,"minHeight":240,"layout":{"type":"constrained"}} -->
<div class="wp-block-cover" style="min-height:240px"><span aria-hidden="true" class="wp-block-cover__background has-black-background-color has-background-dim-100 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:paragraph -->
<p></p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:cover -->`;

// Everything a fixed style answers for, plus the core blocks people put in a
// modal. Themes reach these through element rules (`ul`, `blockquote`,
// `input`), so this is where their styles would show first.
const RICH = `${ SAMPLE }

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">What you get</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Read <a href="#terms">the terms</a> and use <code>AUTUMN20</code> at checkout.</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>Free delivery</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Easy returns</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p>The best pens I own.</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:table -->
<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>Notebook</td><td>£12</td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:details -->
<details class="wp-block-details"><summary>How long does it last?</summary><!-- wp:paragraph -->
<p>Until Sunday.</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details -->

<!-- wp:search {"label":"Search","buttonText":"Search"} /-->`;

/**
 * Runs a callback with logged-in request utils.
 *
 * @param {Object}                           config   Playwright config.
 * @param {(utils: Object) => Promise<void>} callback Receives the request utils.
 * @return {Promise<void>}
 */
async function withRequestUtils( config, callback ) {
	const { storageState, baseURL } = config.projects[ 0 ].use;
	const context = await request.newContext( { baseURL } );
	const requestUtils = new RequestUtils( context, {
		storageStatePath: storageState,
	} );

	await requestUtils.setupRest();
	await callback( requestUtils );
	await context.dispose();
}

/**
 * Removes this suite's modals, including any left by an interrupted run.
 *
 * @param {Object} requestUtils e2e request utils.
 * @return {Promise<void>}
 */
async function removeFixtures( requestUtils ) {
	const modals = await requestUtils.rest( {
		path: '/wp/v2/mk_modal',
		params: {
			per_page: 100,
			search: PREFIX,
			status: 'publish,draft,trash',
		},
	} );

	await Promise.all(
		modals
			.filter( ( modal ) => modal.slug.startsWith( PREFIX ) )
			.map( ( modal ) =>
				requestUtils.rest( {
					path: `/wp/v2/mk_modal/${ modal.id }`,
					method: 'DELETE',
					params: { force: true },
				} )
			)
	);
}

/**
 * Makes every modal the comparison opens.
 *
 * @param {Object} requestUtils e2e request utils.
 * @return {Promise<void>}
 */
async function createFixtures( requestUtils ) {
	await removeFixtures( requestUtils );

	for ( const style of STYLES ) {
		const className = `is-style-${ style }`;

		for ( const [ layout, position ] of LAYOUTS ) {
			await createModal( requestUtils, {
				slug: `${ PREFIX }${ style }-${ layout }`,
				attributes: {
					modalLayout: layout,
					className,
					...( position ? { position } : {} ),
				},
				inner: ( layout === 'split' ? MEDIA : '' ) + SAMPLE,
			} );
		}

		await createModal( requestUtils, {
			slug: `${ PREFIX }${ style }-rich`,
			attributes: { modalLayout: 'centered', className },
			inner: RICH,
		} );
	}

	await createModal( requestUtils, {
		slug: `${ PREFIX }native`,
		attributes: { modalLayout: 'centered' },
		inner: SAMPLE,
	} );
}

module.exports = {
	LAYOUTS,
	PREFIX,
	STYLES,
	createFixtures,
	removeFixtures,
	withRequestUtils,
};

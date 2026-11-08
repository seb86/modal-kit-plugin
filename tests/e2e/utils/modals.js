/**
 * Helpers to create modals through the REST API in e2e tests.
 */

/**
 * Serialised block markup for a modal.
 *
 * @param {Object} attributes Modal block attributes.
 * @param {string} inner      Inner block markup.
 * @return {string} Post content.
 */
function modalMarkup( attributes, inner ) {
	return `<!-- wp:modal-kit/modal ${ JSON.stringify( {
		lock: { move: true, remove: true },
		...attributes,
	} ) } -->
${ inner }
<!-- /wp:modal-kit/modal -->`;
}

const MEDIA = `<!-- wp:cover {"dimRatio":100,"overlayColor":"accent-3","isUserOverlayColor":true,"minHeight":240,"layout":{"type":"constrained"}} -->
<div class="wp-block-cover" style="min-height:240px"><span aria-hidden="true" class="wp-block-cover__background has-accent-3-background-color has-background-dim-100 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:paragraph -->
<p></p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:cover -->`;

const CONTENT = `<!-- wp:heading -->
<h2 class="wp-block-heading">20% off every notebook and pen.</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Use code AUTUMN20 at checkout.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Shop the sale</a></div>
<!-- /wp:button -->

<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button">No thanks</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;

const SPLIT_CONTENT = `${ MEDIA }

<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">${ CONTENT }</div>
<!-- /wp:group -->`;

/**
 * Creates a published modal.
 *
 * @param {Object} requestUtils         e2e request utils.
 * @param {Object} options              Modal options.
 * @param {string} options.slug         Post slug.
 * @param {string} [options.title]      Post title (defaults to the slug).
 * @param {Object} [options.attributes] Modal block attributes.
 * @param {Object} [options.meta]       Post meta (triggers, rules, overrides).
 * @param {string} [options.inner]      Inner block markup (defaults to sample content).
 * @return {Promise<Object>} REST response (the post).
 */
function createModal(
	requestUtils,
	{ slug, title, attributes = {}, meta = {}, inner }
) {
	const content =
		inner ??
		( attributes.modalLayout === 'split' ? SPLIT_CONTENT : CONTENT );
	const prefixedMeta = Object.fromEntries(
		Object.entries( meta ).map( ( [ key, value ] ) => [
			`_modal_kit_${ key }`,
			value,
		] )
	);

	return requestUtils.rest( {
		path: '/wp/v2/mk_modal',
		method: 'POST',
		data: {
			title: title ?? slug,
			slug,
			status: 'publish',
			content: modalMarkup( attributes, content ),
			meta: prefixedMeta,
		},
	} );
}

/**
 * Deletes every modal.
 *
 * @param {Object} requestUtils e2e request utils.
 * @return {Promise<void>}
 */
async function deleteAllModals( requestUtils ) {
	const modals = await requestUtils.rest( {
		path: '/wp/v2/mk_modal',
		params: { per_page: 100, status: 'publish,draft,trash,future,private' },
	} );

	await Promise.all(
		modals.map( ( modal ) =>
			requestUtils.rest( {
				path: `/wp/v2/mk_modal/${ modal.id }`,
				method: 'DELETE',
				params: { force: true },
			} )
		)
	);
}

/**
 * Creates a new modal in the editor and dismisses the pattern picker.
 *
 * @param {Object} admin  e2e admin utils.
 * @param {Object} page   Playwright page.
 * @param {Object} [args] createNewPost arguments.
 * @return {Promise<void>}
 */
async function newBlankModal( admin, page, args = {} ) {
	await admin.createNewPost( { postType: 'mk_modal', ...args } );
	await page.getByRole( 'button', { name: 'Start blank' } ).click();
}

/**
 * Clears Modal Kit's localStorage on the first page load of this tab only,
 * so frequency rules start fresh but reloads keep their memory.
 *
 * @param {Object} page Playwright page.
 * @return {Promise<void>}
 */
function freshStorage( page ) {
	return page.addInitScript( () => {
		if ( ! window.sessionStorage.getItem( 'mk-e2e-cleared' ) ) {
			window.localStorage.clear();
			window.sessionStorage.setItem( 'mk-e2e-cleared', '1' );
		}
	} );
}

/**
 * Saves one Settings tab through the REST settings endpoint.
 *
 * @param {Object} requestUtils e2e request utils.
 * @param {string} tab          general | display | accessibility | tools | pro.
 * @param {Object} values       Values (missing keys fall back to defaults).
 * @return {Promise<Object>} Response.
 */
function setSettings( requestUtils, tab, values ) {
	return requestUtils.rest( {
		path: '/wp/v2/settings',
		method: 'POST',
		data: { [ `modal_kit_${ tab }` ]: values },
	} );
}

/**
 * Clears the current user's dismissals of Pro listings and notices.
 *
 * @param {Object} requestUtils e2e request utils.
 * @return {Promise<Object>} Response.
 */
function resetDismissals( requestUtils ) {
	return requestUtils.rest( {
		path: '/wp/v2/users/me',
		method: 'POST',
		data: { meta: { modal_kit_dismissed: {} } },
	} );
}

module.exports = {
	createModal,
	deleteAllModals,
	freshStorage,
	newBlankModal,
	resetDismissals,
	setSettings,
};

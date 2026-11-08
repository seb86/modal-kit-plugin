/**
 * Before the run: logs in, notes the active theme and makes the modals. A
 * failed test restarts Playwright's worker, so this can't live in a beforeAll.
 */
const { createFixtures, withRequestUtils } = require( './fixtures' );

module.exports = ( config ) =>
	withRequestUtils( config, async ( requestUtils ) => {
		const [ active ] = await requestUtils.rest( {
			path: '/wp/v2/themes',
			params: { status: 'active' },
		} );

		process.env.MODAL_KIT_ACTIVE_THEME = active.stylesheet;
		await createFixtures( requestUtils );

		// A suite that just swapped the plugin link can leave bad plugin URLs.
		const { waitForPluginUrls } =
			await import( '../../bin/stage-plugins.mjs' );

		await waitForPluginUrls(
			new URL(
				'/?modal=mk-themes-fieldnote-centered',
				config.projects[ 0 ].use.baseURL
			).href
		);
	} );

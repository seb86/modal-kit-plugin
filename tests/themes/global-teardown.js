/**
 * After the run: puts the theme back and removes the modals.
 */
const { removeFixtures, withRequestUtils } = require( './fixtures' );

module.exports = ( config ) =>
	withRequestUtils( config, async ( requestUtils ) => {
		await requestUtils.activateTheme( process.env.MODAL_KIT_ACTIVE_THEME );
		await removeFixtures( requestUtils );
	} );

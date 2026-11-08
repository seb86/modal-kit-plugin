/**
 * URL hash or query: opens when the visitor arrives with a matching query
 * parameter (utm_campaign=autumn, or just utm_campaign) or hash (#offer).
 * Links to the modal itself (#modal-slug, ?modal=slug) always work and don't
 * need this trigger.
 */

/**
 * Whether the current URL matches a trigger value.
 *
 * @param {string} value    Query (key or key=value) or hash (#name).
 * @param {URL}    location URL to test.
 * @return {boolean} Match.
 */
export function urlMatches( value, location ) {
	const wanted = ( value ?? '' ).trim();

	if ( ! wanted ) {
		return false;
	}

	if ( wanted.startsWith( '#' ) ) {
		return location.hash === wanted;
	}

	const parts = wanted.replace( /^\?/, '' ).split( '=' );
	const actual = location.searchParams.get( parts[ 0 ] );

	if ( actual === null ) {
		return false;
	}

	return (
		parts[ 1 ] === undefined || actual === decodeURIComponent( parts[ 1 ] )
	);
}

/**
 * @param {Object}     trigger       Settings.
 * @param {string}     trigger.value Query or hash to match.
 * @param {() => void} fire          Opens the modal.
 * @return {() => void} Cleanup.
 */
export default function start( { value }, fire ) {
	const check = () => {
		if ( urlMatches( value, new URL( window.location.href ) ) ) {
			fire();
		}
	};

	check();
	window.addEventListener( 'hashchange', check );

	return () => window.removeEventListener( 'hashchange', check );
}

/**
 * Page load + delay: opens N seconds after the page loads.
 *
 * @param {Object}     trigger       Settings.
 * @param {number}     trigger.delay Seconds.
 * @param {() => void} fire          Opens the modal.
 * @return {() => void} Cleanup.
 */
export default function start( { delay = 0 }, fire ) {
	const timer = window.setTimeout( fire, Math.max( 0, delay ) * 1000 );

	return () => window.clearTimeout( timer );
}

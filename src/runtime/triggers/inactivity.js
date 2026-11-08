/**
 * Inactivity: opens after N seconds without a scroll, click or key press.
 *
 * @param {Object}     trigger       Settings.
 * @param {number}     trigger.delay Seconds of inactivity.
 * @param {() => void} fire          Opens the modal.
 * @return {() => void} Cleanup.
 */
export default function start( { delay = 30 }, fire ) {
	const EVENTS = [ 'scroll', 'click', 'keydown', 'touchstart' ];
	let timer;

	const reset = () => {
		window.clearTimeout( timer );
		timer = window.setTimeout( fire, Math.max( 1, delay ) * 1000 );
	};

	EVENTS.forEach( ( name ) =>
		window.addEventListener( name, reset, { passive: true } )
	);
	reset();

	return () => {
		window.clearTimeout( timer );
		EVENTS.forEach( ( name ) => window.removeEventListener( name, reset ) );
	};
}

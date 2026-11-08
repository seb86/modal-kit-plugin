/**
 * Scroll depth: opens once the visitor has scrolled a percentage of the page.
 *
 * @param {Object}     trigger         Settings.
 * @param {number}     trigger.percent Percentage, 1–100.
 * @param {() => void} fire            Opens the modal.
 * @return {() => void} Cleanup.
 */
export default function start( { percent = 50 }, fire ) {
	const check = () => {
		const root = document.documentElement;
		const scrollable = root.scrollHeight - window.innerHeight;
		const depth =
			scrollable <= 0 ? 100 : ( window.scrollY / scrollable ) * 100;

		if ( depth >= percent ) {
			fire();
		}
	};

	window.addEventListener( 'scroll', check, { passive: true } );
	check();

	return () => window.removeEventListener( 'scroll', check );
}

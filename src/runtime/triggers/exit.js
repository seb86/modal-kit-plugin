/**
 * Leaving the page (shown as such in the UI). On desktop: the pointer leaves through the top of the window.
 * Touch devices have no pointer to track, so the fallback (mockup 1c) is a
 * fast scroll back up after reading down the page.
 *
 * @param {Object}     trigger       Settings.
 * @param {string}     trigger.touch scroll-up | none.
 * @param {() => void} fire          Opens the modal.
 * @return {() => void} Cleanup.
 */
export default function start( { touch = 'scroll-up' }, fire ) {
	const canHover = window.matchMedia(
		'(hover: hover) and (pointer: fine)'
	).matches;

	if ( canHover ) {
		const onOut = ( event ) => {
			if ( ! event.relatedTarget && event.clientY <= 0 ) {
				fire();
			}
		};

		document.documentElement.addEventListener( 'mouseout', onOut );

		return () =>
			document.documentElement.removeEventListener( 'mouseout', onOut );
	}

	if ( touch !== 'scroll-up' ) {
		return () => {};
	}

	// Fast scroll up: at least 30% of the viewport within 400ms of the
	// upward run starting, after the visitor has read at least one screen.
	let maxY = window.scrollY;
	let lastY = window.scrollY;
	let run = null;

	const onScroll = () => {
		const now = window.performance.now();
		const y = window.scrollY;

		maxY = Math.max( maxY, y );

		if ( y >= lastY ) {
			run = null;
		} else {
			run = run ?? { fromY: lastY, startedAt: now };

			if (
				maxY >= window.innerHeight &&
				run.fromY - y >= window.innerHeight * 0.3 &&
				now - run.startedAt <= 400
			) {
				fire();
			}
		}

		lastY = y;
	};

	window.addEventListener( 'scroll', onScroll, { passive: true } );

	return () => window.removeEventListener( 'scroll', onScroll );
}

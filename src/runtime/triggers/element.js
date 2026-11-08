/**
 * Element in view: opens when a block with the given anchor scrolls into view.
 *
 * @param {Object}     trigger        Settings.
 * @param {string}     trigger.anchor HTML id of the block.
 * @param {() => void} fire           Opens the modal.
 * @return {() => void} Cleanup.
 */
export default function start( { anchor }, fire ) {
	const target = anchor
		? document.getElementById( anchor.replace( /^#/, '' ) )
		: null;

	if ( ! target || ! ( 'IntersectionObserver' in window ) ) {
		return () => {};
	}

	const observer = new window.IntersectionObserver(
		( entries ) => {
			if ( entries.some( ( entry ) => entry.isIntersecting ) ) {
				fire();
			}
		},
		{ threshold: 0.25 }
	);

	observer.observe( target );

	return () => observer.disconnect();
}

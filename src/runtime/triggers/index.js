/**
 * Automatic triggers. Each type is its own chunk, imported only when a modal
 * on the page uses it. A trigger module exports `start( trigger, fire )` and
 * returns a cleanup function; each trigger fires at most once per page view.
 */
import { log } from '../log';

const LOADERS = {
	load: () => import( /* webpackChunkName: "trigger-load" */ './load' ),
	scroll: () => import( /* webpackChunkName: "trigger-scroll" */ './scroll' ),
	exit: () => import( /* webpackChunkName: "trigger-exit" */ './exit' ),
	time: () => import( /* webpackChunkName: "trigger-time" */ './time' ),
	inactivity: () =>
		import( /* webpackChunkName: "trigger-inactivity" */ './inactivity' ),
	url: () => import( /* webpackChunkName: "trigger-url" */ './url' ),
	element: () =>
		import( /* webpackChunkName: "trigger-element" */ './element' ),
};

/**
 * Starts every trigger of a modal.
 *
 * @param {Object[]}               triggers Trigger settings from the modal meta.
 * @param {(type: string) => void} open     Opens the modal for a trigger type.
 */
export function startTriggers( triggers, open ) {
	for ( const trigger of triggers ?? [] ) {
		const load = LOADERS[ trigger.type ];

		if ( ! load ) {
			continue;
		}

		load()
			.then( ( { default: start } ) => {
				let stop = null;
				let fired = false;

				// A trigger may fire while starting (e.g. already scrolled
				// far enough), before its cleanup function exists.
				stop = start( trigger, () => {
					if ( fired ) {
						return;
					}
					fired = true;
					stop?.();
					open( trigger.type );
				} );

				if ( fired ) {
					stop();
				}
			} )
			.catch( ( error ) => log( `trigger "${ trigger.type }"`, error ) );
	}
}

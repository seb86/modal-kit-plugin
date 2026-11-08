/**
 * Add-ons can hold a modal's triggers back (data-modal-kit-wait) and the
 * modal starts once they're done, whichever script runs first, or after a
 * few seconds if an add-on never finishes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isWaiting, whenReady } from '../../src/runtime/wait';

/**
 * Just enough of a dialog: attributes on itself and one marker inside.
 *
 * @param {boolean} onDialog Marker on the dialog.
 * @param {boolean} inside   Marker on an element inside.
 * @return {Object} Dialog.
 */
function fakeDialog( onDialog, inside ) {
	const marker = { waiting: inside };

	return {
		marker,
		waiting: onDialog,
		hasAttribute: function hasAttribute() {
			return this.waiting;
		},
		querySelector() {
			return marker.waiting ? marker : null;
		},
	};
}

let observers = [];

beforeEach( () => {
	vi.useFakeTimers();
	observers = [];
	globalThis.window = {
		setTimeout,
		clearTimeout,
		MutationObserver: class {
			constructor( callback ) {
				this.callback = callback;
				this.connected = false;
				observers.push( this );
			}
			observe() {
				this.connected = true;
			}
			disconnect() {
				this.connected = false;
			}
		},
	};
} );

afterEach( () => {
	vi.useRealTimers();
	delete globalThis.window;
} );

// An attribute changed: the observers hear about it.
const mutate = () =>
	observers.forEach(
		( observer ) => observer.connected && observer.callback()
	);

describe( 'whenReady', () => {
	it( 'starts at once when nothing waits (the add-on ran first)', () => {
		const dialog = fakeDialog( false, false );
		const start = vi.fn();

		whenReady( dialog, start );

		expect( start ).toHaveBeenCalledOnce();
		expect( observers ).toHaveLength( 0 );
	} );

	it( 'waits for a marker inside the dialog (the modal ran first)', () => {
		const dialog = fakeDialog( false, true );
		const start = vi.fn();

		expect( isWaiting( dialog ) ).toBe( true );
		whenReady( dialog, start );
		expect( start ).not.toHaveBeenCalled();

		dialog.marker.waiting = false;
		mutate();
		mutate();

		expect( start ).toHaveBeenCalledOnce();
		vi.advanceTimersByTime( 10000 );
		expect( start ).toHaveBeenCalledOnce();
	} );

	it( 'waits for every marker, on the dialog too', () => {
		const dialog = fakeDialog( true, true );
		const start = vi.fn();

		whenReady( dialog, start );
		dialog.marker.waiting = false;
		mutate();
		expect( start ).not.toHaveBeenCalled();

		dialog.waiting = false;
		mutate();
		expect( start ).toHaveBeenCalledOnce();
	} );

	it( 'starts anyway after the limit', () => {
		const dialog = fakeDialog( true, false );
		const start = vi.fn();

		whenReady( dialog, start, 4000 );
		vi.advanceTimersByTime( 3999 );
		expect( start ).not.toHaveBeenCalled();
		vi.advanceTimersByTime( 1 );
		expect( start ).toHaveBeenCalledOnce();
		expect( observers[ 0 ].connected ).toBe( false );
	} );
} );

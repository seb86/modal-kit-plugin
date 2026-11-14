/**
 * Modals start, and the page view counts, once the visitor has the page: not
 * while it's prerendered, and not on a LiteSpeed Guest Mode page that is
 * about to reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	GUEST_GRACE,
	GUEST_LIMIT,
	guestCheckPending,
	whenShown,
} from '../../src/runtime/shown';

let observers;

/**
 * Just enough of a window. Each test gets its own, so the page starts over.
 *
 * @param {Object}  options                Options.
 * @param {boolean} [options.prerendering] Whether the page is prerendered.
 * @param {string}  [options.vary]         Guest Mode's `litespeed_vary`, if its script ran.
 * @param {Object}  [options.session]      sessionStorage items.
 * @param {boolean} [options.observer]     Whether PerformanceObserver exists.
 * @return {Object} Window.
 */
function fakeWindow( {
	prerendering = false,
	vary,
	session = {},
	observer = true,
} = {} ) {
	const listeners = {};
	const win = {
		setTimeout,
		clearTimeout,
		sessionStorage: {
			getItem: ( key ) => session[ key ] ?? null,
			setItem: ( key, value ) => {
				session[ key ] = value;
			},
		},
		document: {
			prerendering,
			addEventListener: ( type, callback ) => {
				listeners[ type ] = callback;
			},
		},
		activate() {
			win.document.prerendering = false;
			listeners.prerenderingchange?.();
		},
	};

	if ( vary !== undefined ) {
		win.litespeed_vary = vary;
	}

	if ( observer ) {
		win.PerformanceObserver = class {
			constructor( callback ) {
				this.callback = callback;
				observers.push( this );
			}
			observe() {
				this.connected = true;
			}
			disconnect() {
				this.connected = false;
			}
		};
	}

	return win;
}

// A request ended: the observers hear about it.
const requestEnded = ( url ) =>
	observers.forEach(
		( observer ) =>
			observer.connected &&
			observer.callback( { getEntries: () => [ { name: url } ] } )
	);

// Lets promise callbacks run.
const settle = () => vi.advanceTimersByTimeAsync( 0 );

beforeEach( () => {
	vi.useFakeTimers();
	observers = [];
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'whenShown', () => {
	it( 'starts at once on an ordinary page, in order', async () => {
		const win = fakeWindow();
		const calls = [];

		whenShown( () => calls.push( 'visit' ), win );
		whenShown( () => calls.push( 'modal' ), win );
		await settle();

		expect( calls ).toEqual( [ 'visit', 'modal' ] );
	} );

	it( 'waits while the page is prerendered', async () => {
		const win = fakeWindow( { prerendering: true } );
		const callback = vi.fn();

		whenShown( callback, win );
		await vi.advanceTimersByTimeAsync( 60000 );
		expect( callback ).not.toHaveBeenCalled();

		win.activate();
		await settle();
		expect( callback ).toHaveBeenCalledOnce();
	} );

	it( 'waits for Guest Mode’s answer, then starts when no reload comes', async () => {
		const win = fakeWindow( { vary: '' } );
		const callback = vi.fn();

		whenShown( callback, win );
		requestEnded( 'https://example.com/wp-content/plugins/other/x.js' );
		await vi.advanceTimersByTimeAsync( GUEST_GRACE );
		expect( callback ).not.toHaveBeenCalled();

		requestEnded(
			'https://example.com/wp-content/plugins/litespeed-cache/guest.vary.php'
		);
		await vi.advanceTimersByTimeAsync( GUEST_GRACE - 1 );
		expect( callback ).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync( 1 );
		expect( callback ).toHaveBeenCalledOnce();
	} );

	it( 'never starts a Guest Mode page that is about to reload', async () => {
		const win = fakeWindow( { vary: '' } );
		const callback = vi.fn();

		whenShown( callback, win );
		requestEnded( '/wp-content/plugins/litespeed-cache/guest.vary.php' );
		// Guest Mode's script reads the answer and reloads.
		win.sessionStorage.setItem( 'litespeed_reloaded', '1' );
		await vi.advanceTimersByTimeAsync( GUEST_LIMIT * 2 );

		expect( callback ).not.toHaveBeenCalled();
	} );

	it( 'starts after a few seconds when Guest Mode never answers', async () => {
		const win = fakeWindow( { vary: '' } );
		const callback = vi.fn();

		whenShown( callback, win );
		await vi.advanceTimersByTimeAsync( GUEST_LIMIT - 1 );
		expect( callback ).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync( 1 );
		expect( callback ).toHaveBeenCalledOnce();
	} );

	it( 'waits the longest time without PerformanceObserver', async () => {
		const win = fakeWindow( { vary: '', observer: false } );
		const callback = vi.fn();

		whenShown( callback, win );
		await vi.advanceTimersByTimeAsync( GUEST_LIMIT );

		expect( callback ).toHaveBeenCalledOnce();
	} );

	it( 'checks Guest Mode once a prerendered page is shown', async () => {
		const win = fakeWindow( { prerendering: true, vary: '' } );
		const callback = vi.fn();

		whenShown( callback, win );
		win.activate();
		await vi.advanceTimersByTimeAsync( GUEST_LIMIT - 1 );
		expect( callback ).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync( 1 );
		expect( callback ).toHaveBeenCalledOnce();
	} );
} );

describe( 'guestCheckPending', () => {
	it( 'is false without Guest Mode’s script', () => {
		expect( guestCheckPending( fakeWindow() ) ).toBe( false );
	} );

	it( 'is true on a guest page that hasn’t reloaded', () => {
		expect( guestCheckPending( fakeWindow( { vary: '' } ) ) ).toBe( true );
	} );

	it( 'is false once the tab has reloaded, or has a vary already', () => {
		expect(
			guestCheckPending(
				fakeWindow( { vary: '', session: { litespeed_reloaded: '1' } } )
			)
		).toBe( false );
		expect( guestCheckPending( fakeWindow( { vary: 'guest' } ) ) ).toBe(
			false
		);
	} );

	it( 'is false when sessionStorage throws, as Guest Mode then stops', () => {
		const win = fakeWindow( { vary: '' } );
		win.sessionStorage.getItem = () => {
			throw new Error( 'blocked' );
		};

		expect( guestCheckPending( win ) ).toBe( false );
	} );
} );

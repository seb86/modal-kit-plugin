/**
 * The browser rule evaluator (runtime/rules.js).
 */
import { describe, expect, it } from 'vitest';
import { deviceFor, evaluate } from '../../src/runtime/rules';

const NOW = Date.parse( '2026-10-15T12:00:00Z' );
const DAY = 24 * 60 * 60 * 1000;

function input( overrides = {} ) {
	return {
		rules: {
			frequency: { mode: 'days', days: 7, stopAfterCta: true },
			devices: [ 'desktop', 'tablet', 'mobile' ],
			schedule: { start: '', end: '' },
			minPageViews: 0,
		},
		version: 'v1',
		targeted: true,
		hidden: false,
		seen: null,
		visit: { id: 1, views: 1 },
		site: {
			autoOpenLimit: 1,
			cooldown: 20,
			remember: true,
			breakpoint: 600,
		},
		pageAutoOpens: 0,
		lastAutoOpen: null,
		now: NOW,
		viewportWidth: 1280,
		...overrides,
	};
}

function withRules( rules, overrides = {} ) {
	const base = input();
	return input( { rules: { ...base.rules, ...rules }, ...overrides } );
}

describe( 'deviceFor', () => {
	it.each( [
		[ 375, 'mobile' ],
		[ 599, 'mobile' ],
		[ 600, 'tablet' ],
		[ 1023, 'tablet' ],
		[ 1024, 'desktop' ],
	] )( '%ipx is %s', ( width, device ) => {
		expect( deviceFor( width, 600 ) ).toBe( device );
	} );

	it( 'follows the breakpoint setting', () => {
		expect( deviceFor( 700, 768 ) ).toBe( 'mobile' );
	} );
} );

describe( 'evaluate', () => {
	it( 'allows a fresh visitor', () => {
		expect( evaluate( input() ) ).toBe( true );
	} );

	it( 'blocks where targeting did not match, and hidden visitors', () => {
		expect( evaluate( input( { targeted: false } ) ) ).toMatch(
			/not targeted/
		);
		expect( evaluate( input( { hidden: true } ) ) ).toMatch( /hidden/ );
	} );

	describe( 'frequency', () => {
		const seenAt = ( at, extra = {} ) => ( {
			at,
			version: 'v1',
			visit: 1,
			cta: false,
			...extra,
		} );

		it( 'every N days', () => {
			expect(
				evaluate( input( { seen: seenAt( NOW - 2 * DAY ) } ) )
			).toMatch( /last 7 days/ );
			expect(
				evaluate( input( { seen: seenAt( NOW - 8 * DAY ) } ) )
			).toBe( true );
		} );

		it( 'once per session (visit)', () => {
			const rules = { frequency: { mode: 'session' } };

			expect(
				evaluate( withRules( rules, { seen: seenAt( NOW - 1000 ) } ) )
			).toMatch( /this visit/ );
			expect(
				evaluate(
					withRules( rules, {
						seen: seenAt( NOW - 1000, { visit: 0 } ),
					} )
				)
			).toBe( true );
		} );

		it( 'always', () => {
			expect(
				evaluate(
					withRules(
						{ frequency: { mode: 'always' } },
						{ seen: seenAt( NOW - 1000 ) }
					)
				)
			).toBe( true );
		} );

		it( 'stops after a call-to-action click, even when always', () => {
			const rules = { frequency: { mode: 'always', stopAfterCta: true } };

			expect(
				evaluate(
					withRules( rules, {
						seen: seenAt( NOW - 1000, { cta: true } ),
					} )
				)
			).toMatch( /clicked/ );
		} );

		it( 'never shows again once the visitor completed it, across edits', () => {
			const rules = { frequency: { mode: 'always' } };

			expect(
				evaluate(
					withRules( rules, {
						seen: {
							...seenAt( NOW - 1000 ),
							version: 'v0',
							never: true,
						},
					} )
				)
			).toMatch( /completed/ );
		} );

		it( 'resets when the modal changes', () => {
			expect(
				evaluate(
					input( {
						seen: seenAt( NOW - 1000, { version: 'old' } ),
					} )
				)
			).toBe( true );
		} );

		it( 'is ignored when dismissals are not remembered', () => {
			const base = input();

			expect(
				evaluate(
					input( {
						seen: seenAt( NOW - 1000 ),
						site: { ...base.site, remember: false },
					} )
				)
			).toBe( true );
		} );

		describe( 'at most this many times in total', () => {
			const capped = ( mode, shows, extra = {} ) =>
				withRules(
					{
						frequency: {
							mode,
							days: 7,
							stopAfterCta: false,
							maxShows: 2,
						},
					},
					{
						seen: seenAt( NOW - 30 * DAY, { shows, visit: 0 } ),
						...extra,
					}
				);

			it( 'blocks once the count reaches the cap', () => {
				expect( evaluate( capped( 'always', 1 ) ) ).toBe( true );
				expect( evaluate( capped( 'always', 2 ) ) ).toMatch(
					/already shown 2 times/
				);
				expect( evaluate( capped( 'session', 2 ) ) ).toMatch(
					/already shown 2 times/
				);
				expect( evaluate( capped( 'days', 3 ) ) ).toMatch(
					/already shown 2 times/
				);
			} );

			it( 'means no limit at 0, and starts over when the modal changes', () => {
				const unlimited = capped( 'always', 50 );
				unlimited.rules.frequency.maxShows = 0;

				expect( evaluate( unlimited ) ).toBe( true );
				expect(
					evaluate( capped( 'always', 2, { version: 'v2' } ) )
				).toBe( true );
			} );

			it( 'is ignored when dismissals are not remembered', () => {
				const base = input();

				expect(
					evaluate(
						capped( 'always', 5, {
							site: { ...base.site, remember: false },
						} )
					)
				).toBe( true );
			} );
		} );
	} );

	describe( 'browsers', () => {
		it( 'shows only in the browsers picked', () => {
			const rules = { browsers: { mode: 'only', list: [ 'firefox' ] } };

			expect(
				evaluate( withRules( rules, { browser: 'chrome' } ) )
			).toMatch( /not shown in chrome/ );
			expect(
				evaluate( withRules( rules, { browser: 'firefox' } ) )
			).toBe( true );
		} );

		it( 'leaves out the browsers picked', () => {
			const rules = { browsers: { mode: 'except', list: [ 'in-app' ] } };

			expect(
				evaluate( withRules( rules, { browser: 'in-app' } ) )
			).toMatch( /in-app/ );
			expect(
				evaluate( withRules( rules, { browser: 'safari' } ) )
			).toBe( true );
		} );

		it( 'never blocks with nothing picked, or when unset', () => {
			expect(
				evaluate(
					withRules(
						{ browsers: { mode: 'only', list: [] } },
						{ browser: 'chrome' }
					)
				)
			).toBe( true );
			expect( evaluate( input( { browser: 'opera' } ) ) ).toBe( true );
		} );
	} );

	it( 'respects the schedule', () => {
		expect(
			evaluate(
				withRules( {
					schedule: { start: '2026-10-20T00:00:00Z', end: '' },
				} )
			)
		).toMatch( /start later/ );
		expect(
			evaluate(
				withRules( {
					schedule: { start: '', end: '2026-10-14T00:00:00Z' },
				} )
			)
		).toMatch( /ended/ );
		expect(
			evaluate(
				withRules( {
					schedule: {
						start: '2026-10-12T00:00:00Z',
						end: '2026-10-18T00:00:00Z',
					},
				} )
			)
		).toBe( true );
		expect(
			evaluate( withRules( { schedule: { start: 'soon', end: '' } } ) )
		).toBe( true );
	} );

	it( 'respects devices', () => {
		const rules = { devices: [ 'mobile' ] };

		expect( evaluate( withRules( rules ) ) ).toMatch( /desktop/ );
		expect( evaluate( withRules( rules, { viewportWidth: 375 } ) ) ).toBe(
			true
		);
	} );

	it( 'waits for the minimum page views', () => {
		const rules = { minPageViews: 2 };

		expect( evaluate( withRules( rules ) ) ).toMatch( /page view 2/ );
		expect(
			evaluate( withRules( rules, { visit: { id: 1, views: 2 } } ) )
		).toBe( true );
	} );

	it( 'applies the site-wide limit and cool-down', () => {
		expect( evaluate( input( { pageAutoOpens: 1 } ) ) ).toMatch( /limit/ );
		expect(
			evaluate(
				input( {
					pageAutoOpens: 1,
					site: {
						autoOpenLimit: 0,
						cooldown: 0,
						remember: true,
						breakpoint: 600,
					},
				} )
			)
		).toBe( true );
		expect( evaluate( input( { lastAutoOpen: NOW - 5000 } ) ) ).toMatch(
			/cool-down/
		);
		expect( evaluate( input( { lastAutoOpen: NOW - 25000 } ) ) ).toBe(
			true
		);
	} );
} );

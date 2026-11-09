/**
 * The rule evaluator: decides in the browser whether an automatic trigger may
 * open a modal. Pure, so it can be unit
 * tested: everything it needs is passed in.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Device class for a viewport width.
 *
 * @param {number} width      Viewport width in px.
 * @param {number} breakpoint Mobile breakpoint (Settings → Display).
 * @return {'mobile'|'tablet'|'desktop'} Device.
 */
export function deviceFor( width, breakpoint = 600 ) {
	if ( width < breakpoint ) {
		return 'mobile';
	}

	return width < 1024 ? 'tablet' : 'desktop';
}

/**
 * Whether a date string is valid.
 *
 * @param {string} value ISO date.
 * @return {number|null} Timestamp, or null.
 */
function parseDate( value ) {
	if ( ! value ) {
		return null;
	}

	const time = Date.parse( value );

	return Number.isNaN( time ) ? null : time;
}

/**
 * Evaluates the rules for one automatic open.
 *
 * @param {Object}  input                Everything the rules depend on.
 * @param {Object}  input.rules          Modal rules: frequency, devices, browsers, schedule, minPageViews.
 * @param {string}  input.version        Modal content version.
 * @param {boolean} input.targeted       Whether page targeting matched (server).
 * @param {boolean} input.hidden         Whether the logged-in visitor is excluded (server).
 * @param {Object}  [input.seen]         What this browser remembers: { at, version, visit, cta, shows }.
 * @param {Object}  input.visit          Current visit: { id, views }.
 * @param {Object}  input.site           Site limits: { autoOpenLimit, cooldown, remember, breakpoint }.
 * @param {number}  input.pageAutoOpens  Automatic opens already on this page view.
 * @param {number}  [input.lastAutoOpen] Timestamp of the last automatic open (any page).
 * @param {number}  input.now            Current timestamp.
 * @param {number}  input.viewportWidth  Viewport width in px.
 * @param {string}  [input.browser]      Browser id (runtime/browser.js).
 * @return {true|string} True to allow, or the reason it's blocked.
 */
export function evaluate( input ) {
	const {
		rules,
		version,
		targeted,
		hidden,
		seen,
		visit,
		site,
		pageAutoOpens,
		lastAutoOpen,
		now,
		viewportWidth,
		browser = 'other',
	} = input;

	if ( ! targeted ) {
		return 'not targeted on this page';
	}

	if ( hidden ) {
		return 'hidden for this visitor';
	}

	const start = parseDate( rules.schedule?.start );

	if ( start !== null && now < start ) {
		return 'scheduled to start later';
	}

	const end = parseDate( rules.schedule?.end );

	if ( end !== null && now > end ) {
		return 'schedule has ended';
	}

	const device = deviceFor( viewportWidth, site.breakpoint );

	if (
		Array.isArray( rules.devices ) &&
		! rules.devices.includes( device )
	) {
		return `not shown on ${ device }`;
	}

	const browsers = rules.browsers ?? {};
	const listed = ( browsers.list ?? [] ).includes( browser );

	// An empty list never blocks: "Only these" with nothing picked is unset.
	if (
		( browsers.list ?? [] ).length > 0 &&
		( ( browsers.mode === 'only' && ! listed ) ||
			( browsers.mode === 'except' && listed ) )
	) {
		return `not shown in ${ browser }`;
	}

	if ( ( visit.views ?? 0 ) < ( rules.minPageViews ?? 0 ) ) {
		return `waiting for page view ${ rules.minPageViews }`;
	}

	if ( site.autoOpenLimit > 0 && pageAutoOpens >= site.autoOpenLimit ) {
		return 'auto-open limit for this page reached';
	}

	if (
		site.cooldown > 0 &&
		lastAutoOpen &&
		now - lastAutoOpen < site.cooldown * 1000
	) {
		return 'cool-down between modals';
	}

	// A visitor who finished the modal's goal (Pro: a form with "Don't show
	// this modal again") never sees it automatically again.
	if ( site.remember && seen?.never ) {
		return 'visitor already completed this modal';
	}

	// Frequency only applies when dismissals are remembered, and to the
	// current content: editing a modal resets it.
	const memory = site.remember && seen?.version === version ? seen : null;

	if ( memory ) {
		const frequency = rules.frequency ?? {};

		if ( frequency.stopAfterCta && memory.cta ) {
			return 'visitor already clicked a button';
		}

		// Counts automatic opens only: links always open the modal.
		if (
			frequency.maxShows > 0 &&
			( memory.shows ?? 0 ) >= frequency.maxShows
		) {
			return `already shown ${ frequency.maxShows } times`;
		}

		if ( frequency.mode === 'session' && memory.visit === visit.id ) {
			return 'already shown this visit';
		}

		if (
			frequency.mode === 'days' &&
			now - memory.at < ( frequency.days ?? 7 ) * DAY
		) {
			return `already shown in the last ${ frequency.days } days`;
		}
	}

	return true;
}

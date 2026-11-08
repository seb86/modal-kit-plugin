/**
 * Builds the theme comparison's report from Playwright's results: every
 * screenshot side by side with the reference, and the exact properties that
 * differ. See bin/test-themes.mjs.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ANSI = new RegExp( `${ String.fromCharCode( 27 ) }\\[[0-9;]*m`, 'g' );

const escapeHtml = ( text ) =>
	String( text ).replace(
		/[&<>"]/g,
		( char ) =>
			( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } )[
				char
			]
	);

/**
 * Every test in Playwright's JSON report, with its theme.
 *
 * @param {Object}   suite  Suite.
 * @param {string[]} titles Titles so far.
 * @return {Object[]} Tests: theme, title, attachments and errors.
 */
function collect( suite, titles = [] ) {
	const inner = ( suite.suites ?? [] ).flatMap( ( child ) =>
		collect( child, [ ...titles, child.title ] )
	);
	const own = ( suite.specs ?? [] ).flatMap( ( spec ) =>
		spec.tests.flatMap( ( { results } ) =>
			// The last attempt decides, as it does for Playwright's own result.
			results.slice( -1 ).map( ( result ) => ( {
				theme: titles[ titles.length - 1 ],
				title: spec.title,
				attachments: result.attachments ?? [],
				errors: result.errors ?? [],
				status: result.status,
			} ) )
		)
	);

	return [ ...inner, ...own ];
}

/**
 * Reads the `element property: value` lines out of a text snapshot's failure.
 *
 * @param {string} message Error message.
 * @return {Object[]} Differences: line, expected and received.
 */
function propertyDifferences( message ) {
	const lines = message.replace( ANSI, '' ).split( '\n' );
	const expected = new Map();
	const received = new Map();

	for ( const line of lines ) {
		const match = line.match( /^\s*([-+])\s*(.+?): (.*)$/ );

		if ( match ) {
			( match[ 1 ] === '-' ? expected : received ).set(
				match[ 2 ],
				match[ 3 ]
			);
		}
	}

	return [ ...new Set( [ ...expected.keys(), ...received.keys() ] ) ].map(
		( property ) => ( {
			property,
			expected: expected.get( property ) ?? '',
			received: received.get( property ) ?? '',
		} )
	);
}

const STYLES = `
body{margin:0;padding:24px;background:#f4f3f7;color:#1c1a24;font:14px/1.5 system-ui,sans-serif}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px}
.filter{margin:16px 0}
.scroll{overflow:auto;background:#fff;border:1px solid #d5d3dd;border-radius:8px}
table{border-collapse:collapse}th,td{padding:8px;border:1px solid #e5e3eb;vertical-align:top;text-align:left}
thead th{position:sticky;top:0;background:#fff;z-index:1}
td.name{font-weight:600;white-space:nowrap}
img{display:block;max-width:220px;height:auto}
td.differs{background:#fdecec}td.differs small{color:#a11a1a;font-weight:600}
.props td{font-family:ui-monospace,monospace;font-size:12px}
.ok{color:#00784b}.bad{color:#a11a1a}
body.only-diffs tr.same{display:none}
`;

/**
 * Writes artifacts/themes/index.html.
 *
 * @param {Object}   options           Options.
 * @param {string}   options.reference Reference theme.
 * @param {string[]} options.themes    Compared themes.
 * @param {string}   options.artifacts Output folder.
 * @return {{file: string, summary: string}} Report path and a one-line summary.
 */
export function writeReport( { reference, themes, artifacts } ) {
	const resultsFile = join( artifacts, 'results.json' );
	const results = existsSync( resultsFile )
		? JSON.parse( readFileSync( resultsFile, 'utf8' ) )
		: { suites: [] };
	const tests = results.suites.flatMap( ( suite ) => collect( suite ) );
	const reports = themes.map( ( theme ) => {
		const own = tests.filter( ( item ) => item.theme === theme );
		const differs = new Set();
		const properties = new Map();
		const problems = [];

		for ( const item of own ) {
			for ( const attachment of item.attachments ) {
				const match = attachment.name.match( /^(.+)-actual\.png$/ );

				if ( match ) {
					differs.add( match[ 1 ] );
				}
			}

			for ( const error of item.errors ) {
				const message = error.message ?? '';

				if ( /\.txt/.test( message ) ) {
					for ( const row of propertyDifferences( message ) ) {
						properties.set( row.property, row );
					}
				} else if ( ! /\.png/.test( message ) ) {
					problems.push(
						`${ item.title }: ${
							message.replace( ANSI, '' ).split( '\n' )[ 0 ]
						}`
					);
				}
			}
		}

		return { theme, differs, properties, problems };
	} );

	const referenceDir = join( artifacts, 'reference' );
	const names = existsSync( referenceDir )
		? readdirSync( referenceDir )
				.filter( ( file ) => file.endsWith( '.png' ) )
				.map( ( file ) => file.replace( /\.png$/, '' ) )
				.sort()
		: [];
	const src = ( file ) => relative( artifacts, file ).replaceAll( '\\', '/' );

	const rows = names
		.map( ( name ) => {
			const cells = reports.map( ( { theme, differs } ) => {
				const file = join( artifacts, 'shots', theme, `${ name }.png` );

				if ( ! existsSync( file ) ) {
					return '<td>—</td>';
				}

				const bad = differs.has( name );

				return `<td class="${ bad ? 'differs' : '' }"><img loading="lazy" src="${ src(
					file
				) }" alt="">${ bad ? '<small>differs</small>' : '' }</td>`;
			} );
			const same = reports.every(
				( { differs } ) => ! differs.has( name )
			);

			return `<tr class="${ same ? 'same' : '' }"><td class="name">${ escapeHtml(
				name
			) }</td><td><img loading="lazy" src="${ src(
				join( referenceDir, `${ name }.png` )
			) }" alt=""></td>${ cells.join( '' ) }</tr>`;
		} )
		.join( '\n' );

	const details = reports
		.map( ( { theme, differs, properties, problems } ) => {
			const clean =
				! differs.size && ! properties.size && ! problems.length;
			const table = properties.size
				? `<table class="props"><thead><tr><th>Element and property</th><th>${ escapeHtml(
						reference
					) }</th><th>${ escapeHtml(
						theme
					) }</th></tr></thead><tbody>${ [ ...properties.values() ]
						.map(
							( row ) =>
								`<tr><td>${ escapeHtml(
									row.property
								) }</td><td>${ escapeHtml(
									row.expected
								) }</td><td>${ escapeHtml( row.received ) }</td></tr>`
						)
						.join( '' ) }</tbody></table>`
				: '';
			const notes = problems.length
				? `<ul>${ problems
						.map( ( text ) => `<li>${ escapeHtml( text ) }</li>` )
						.join( '' ) }</ul>`
				: '';

			return `<h2>${ escapeHtml( theme ) } <span class="${
				clean ? 'ok' : 'bad'
			}">${
				clean
					? 'matches'
					: `${ differs.size } screenshots and ${ properties.size } properties differ`
			}</span></h2>${ notes }${ table }`;
		} )
		.join( '\n' );

	const clean = reports.filter(
		( { differs, properties, problems } ) =>
			! differs.size && ! properties.size && ! problems.length
	).length;
	const summary = `${ clean } of ${ reports.length } themes match ${ reference }.`;

	const file = join( artifacts, 'index.html' );

	writeFileSync(
		file,
		`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Modal Kit theme comparison</title><style>${ STYLES }</style></head>
<body><h1>Modal Kit theme comparison</h1><p>${ escapeHtml( summary ) }</p>
<label class="filter"><input type="checkbox" onchange="document.body.classList.toggle('only-diffs',this.checked)"> Only show rows with a difference</label>
<div class="scroll"><table><thead><tr><th>Screenshot</th><th>${ escapeHtml(
			reference
		) } (reference)</th>${ reports
			.map( ( { theme } ) => `<th>${ escapeHtml( theme ) }</th>` )
			.join( '' ) }</tr></thead><tbody>${ rows }</tbody></table></div>
${ details }
</body></html>`
	);

	return { file, summary };
}

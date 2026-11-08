/**
 * Style import and export (plan §3.6, mockups 14c–14d): checks a style JSON
 * against schema/style.json, sanitises every value to a colour, length or
 * font stack, fills what's missing from Fieldnote, and runs the contrast
 * test. includes/StyleSchema.php does the same on the server, which is what
 * decides; this copy lets the import dialog show the checks before saving.
 */
import schema from '../../schema/style.json';
import fieldnote from './fieldnote.json';
import { contrast } from './contrast';

export const GROUPS = [ 'color', 'font', 'radius' ];

// Anything that could reach outside a CSS value.
const FORBIDDEN = /url\s*\(|expression|javascript:|[;{}<>\\@]/i;

const PATTERNS = {
	color: /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+))?\s*\))$/i,
	length: /^(?:0|-?\d*\.?\d+(?:px|em|rem|%|vw|vh|ch))$/,
	family: /^[a-z0-9 ,'"-]{1,200}$/i,
};

/**
 * A value cleaned for its kind, or undefined when it isn't one.
 *
 * @param {string}  kind  color, length, family, weight, size or shadow.
 * @param {unknown} value Raw value.
 * @return {string|number|undefined} Clean value.
 */
export function sanitizeValue( kind, value ) {
	if ( typeof value !== 'string' && typeof value !== 'number' ) {
		return undefined;
	}

	const text = String( value ).trim();

	if ( FORBIDDEN.test( text ) ) {
		return undefined;
	}

	if ( kind === 'weight' ) {
		const weight = Number( text );

		return Number.isInteger( weight ) && weight >= 100 && weight <= 900
			? weight
			: undefined;
	}

	if ( kind === 'size' ) {
		// 36 or "36px" (Harbor), kept as given so a round trip matches.
		const size = parseFloat( text );

		return /^\d+(?:\.\d+)?(?:px)?$/.test( text ) && size >= 8 && size <= 120
			? value
			: undefined;
	}

	if ( kind === 'shadow' ) {
		// Lengths, colours, commas and "inset"; rgb()/rgba() the only functions.
		const ok =
			/^[#a-z0-9 .,()%-]{1,200}$/i.test( text ) &&
			! /\b(?!rgba?\()[a-z-]+\(/i.test( text );

		return ok || text === 'none' ? text : undefined;
	}

	return PATTERNS[ kind ]?.test( text ) ? text : undefined;
}

/**
 * The style's keys, by group, with their kind.
 *
 * @return {Array<[string|null, string, string]>} [group, key, kind].
 */
export function keys() {
	const list = [];

	for ( const group of GROUPS ) {
		for ( const [ key, spec ] of Object.entries(
			schema.properties[ group ].properties
		) ) {
			list.push( [ group, key, spec[ 'x-kind' ] ] );
		}
	}

	list.push( [ null, 'shadow', schema.properties.shadow[ 'x-kind' ] ] );

	return list;
}

/**
 * A slug from a name: lowercase letters, digits and hyphens.
 *
 * @param {string} name Name.
 * @return {string} Slug.
 */
export function slugify( name ) {
	return String( name ?? '' )
		.toLowerCase()
		.normalize( 'NFKD' )
		.replace( /[̀-ͯ]/g, '' )
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-+|-+$/g, '' )
		.slice( 0, 40 )
		.replace( /-+$/g, '' );
}

/**
 * Reads an imported style: what was found, filled in, ignored or rejected.
 *
 * @param {unknown} raw Parsed JSON.
 * @return {{style: Object|null, found: Object, missing: string[], invalid: string[], ignored: string[], error: string}} Result.
 */
export function readStyle( raw ) {
	const result = {
		style: null,
		found: { color: 0, radius: 0 },
		missing: [],
		invalid: [],
		ignored: [],
		error: '',
	};

	if ( ! raw || typeof raw !== 'object' || Array.isArray( raw ) ) {
		result.error = 'not-a-style';
		return result;
	}

	const label =
		typeof raw.label === 'string'
			? raw.label.replace( /[<>]/g, '' ).trim().slice( 0, 60 )
			: '';
	const style = {
		slug: slugify(
			typeof raw.slug === 'string' && raw.slug ? raw.slug : label
		),
		label,
		description:
			typeof raw.description === 'string'
				? raw.description.replace( /[<>]/g, '' ).trim().slice( 0, 200 )
				: '',
		version:
			Number.isInteger( raw.version ) && raw.version > 0
				? raw.version
				: 1,
	};

	for ( const [ group, key, kind ] of keys() ) {
		const source = group ? ( raw[ group ] ?? {} ) : raw;
		const fallback = group ? fieldnote[ group ][ key ] : fieldnote[ key ];
		const path = group ? `${ group }.${ key }` : key;
		let value;

		if ( source && typeof source === 'object' && key in source ) {
			value = sanitizeValue( kind, source[ key ] );

			if ( value === undefined ) {
				result.invalid.push( path );
			} else if ( group === 'color' || group === 'radius' ) {
				result.found[ group ]++;
			}
		} else if ( fallback !== undefined ) {
			result.missing.push( path );
		}

		if ( value === undefined ) {
			value = fallback;
		}

		if ( value !== undefined ) {
			if ( group ) {
				style[ group ] ??= {};
				style[ group ][ key ] = value;
			} else {
				style[ key ] = value;
			}
		}
	}

	const known = new Set( [
		...Object.keys( schema.properties ),
		...GROUPS.flatMap( ( group ) =>
			Object.keys( schema.properties[ group ].properties ).map(
				( key ) => `${ group }.${ key }`
			)
		),
	] );

	for ( const [ key, value ] of Object.entries( raw ) ) {
		if ( ! known.has( key ) ) {
			result.ignored.push( key );
		} else if (
			GROUPS.includes( key ) &&
			value &&
			typeof value === 'object'
		) {
			for ( const inner of Object.keys( value ) ) {
				if ( ! known.has( `${ key }.${ inner }` ) ) {
					result.ignored.push( `${ key }.${ inner }` );
				}
			}
		}
	}

	if ( ! style.label ) {
		result.error = 'no-name';
	}

	result.style = style;

	return result;
}

/**
 * The contrast test from S1, as import checks it: every text pair at 4.5:1,
 * field borders at 3:1.
 *
 * @param {Object} style Clean style.
 * @return {{pass: boolean, failures: Array<{fg: string, bg: string, ratio: number, min: number}>, summary: Object<string, number>}} Result.
 */
export function contrastCheck( style ) {
	const failures = [];
	const summary = {};

	for ( const [ fg, bg, min, name ] of schema[ 'x-contrast' ] ) {
		const ratio = contrast( style.color[ fg ], style.color[ bg ] );

		if ( name ) {
			summary[ name ] = ratio;
		}

		if ( ratio < min ) {
			failures.push( { fg, bg, ratio, min } );
		}
	}

	return { pass: failures.length === 0, failures, summary };
}

/**
 * A slug and name that don't clash: "terracotta-2" / "Terracotta 2".
 *
 * @param {string}   slug  Wanted slug.
 * @param {string}   label Wanted name.
 * @param {string[]} taken Slugs in use (styles that follow the theme included).
 * @return {{slug: string, label: string}} Free slug and name.
 */
export function freeSlug( slug, label, taken ) {
	if ( ! taken.includes( slug ) ) {
		return { slug, label };
	}

	let n = 2;

	while ( taken.includes( `${ slug }-${ n }` ) ) {
		n++;
	}

	return { slug: `${ slug }-${ n }`, label: `${ label } ${ n }` };
}

/**
 * The export format: src/styles/*.json plus description and version, keys
 * in a fixed order so an import → export round trip gives the same file.
 *
 * @param {Object} style Clean style.
 * @return {string} JSON.
 */
export function exportJson( style ) {
	const ordered = {
		slug: style.slug,
		label: style.label,
		description: style.description ?? '',
		version: style.version ?? 1,
	};

	for ( const group of GROUPS ) {
		ordered[ group ] = { ...style[ group ] };
	}

	if ( style.shadow ) {
		ordered.shadow = style.shadow;
	}

	return JSON.stringify( ordered, null, 2 ) + '\n';
}

/**
 * The shared meta schema must be usable from JS and its defaults must match it.
 */
import { describe, expect, it } from 'vitest';
import schema from '../../schema/modal-meta.json';

/**
 * Minimal checker for the JSON-schema subset the schema uses.
 *
 * @param {unknown} value Value to check.
 * @param {Object}  node  Schema node.
 * @param {string}  path  Path for error messages.
 * @return {string[]} Errors.
 */
function check( value, node, path = '' ) {
	const errors = [];
	const type = Array.isArray( value ) ? 'array' : typeof value;
	const expected = node.type === 'integer' ? 'number' : node.type;

	if ( expected && type !== expected ) {
		return [ `${ path }: expected ${ node.type }, got ${ type }` ];
	}

	if ( node.enum && ! node.enum.includes( value ) ) {
		errors.push( `${ path }: ${ value } not in enum` );
	}

	if ( type === 'array' && node.items ) {
		value.forEach( ( item, i ) =>
			errors.push( ...check( item, node.items, `${ path }[${ i }]` ) )
		);
	}

	if ( type === 'object' && node.properties ) {
		for ( const [ key, child ] of Object.entries( value ) ) {
			if ( ! node.properties[ key ] ) {
				if ( node.additionalProperties === false ) {
					errors.push( `${ path }.${ key }: not allowed` );
				}
				continue;
			}
			errors.push(
				...check( child, node.properties[ key ], `${ path }.${ key }` )
			);
		}
	}

	return errors;
}

describe( 'modal meta schema', () => {
	it( 'defines triggers, rules and overrides', () => {
		expect( Object.keys( schema ) ).toEqual(
			expect.arrayContaining( [ 'triggers', 'rules', 'overrides' ] )
		);
	} );

	it.each( [ 'triggers', 'rules', 'overrides' ] )(
		'has a default for %s that matches the schema',
		( key ) => {
			expect( schema[ key ] ).toHaveProperty( 'default' );
			expect(
				check( schema[ key ].default, schema[ key ], key )
			).toEqual( [] );
		}
	);

	it( 'lists the seven automatic trigger types', () => {
		expect( schema.triggers.items.properties.type.enum ).toEqual( [
			'load',
			'scroll',
			'exit',
			'time',
			'inactivity',
			'url',
			'element',
		] );
	} );
} );

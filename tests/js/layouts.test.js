/**
 * The JS layout resolver must produce the same classes as Layouts.php
 * (both are checked against tests/fixtures/layout-cases.json).
 */
import { describe, expect, it } from 'vitest';
import { addFilter, removeFilter } from '@wordpress/hooks';
import {
	containerClasses,
	containerStyle,
	resolve,
} from '../../src/blocks/modal/layouts';
import cases from '../fixtures/layout-cases.json';

function styleString( style ) {
	return Object.entries( style )
		.map( ( [ name, value ] ) => `${ name }:${ value }` )
		.join( ';' );
}

describe( 'layout resolver', () => {
	it.each( cases.map( ( c ) => [ c.name, c ] ) )(
		'%s',
		( name, { attributes, classes, style } ) => {
			const resolved = resolve( attributes );

			expect( containerClasses( resolved ) ).toEqual( classes );
			expect( styleString( containerStyle( resolved ) ) ).toBe( style );
		}
	);

	it( 'always labels the full-screen close button', () => {
		expect(
			resolve( {
				modalLayout: 'full',
				closeOptions: { visibleLabel: false },
			} ).closeOptions.visibleLabel
		).toBe( true );
	} );

	it( 'opens overlay layouts as modal dialogs', () => {
		expect( resolve( { modalLayout: 'drawer' } ).modal ).toBe( true );
		expect( resolve( { modalLayout: 'corner' } ).modal ).toBe( false );
		expect( resolve( { modalLayout: 'inline' } ).modal ).toBe( false );
	} );

	it( 'takes layouts added by add-ons', () => {
		addFilter( 'modalKit.layouts', 'test/gate', ( layouts ) => ( {
			...layouts,
			gate: {
				overlay: true,
				modal: true,
				positions: [],
				mobile: 'full',
				base: 'centered',
				closable: false,
			},
		} ) );

		const resolved = resolve( {
			modalLayout: 'gate',
			closeOptions: { button: true, esc: true },
		} );

		expect( resolved.closeOptions.button ).toBe( false );
		expect( resolved.closeOptions.esc ).toBe( false );
		expect( containerClasses( resolved ) ).toEqual( [
			'modal-kit',
			'modal-kit--gate',
			'modal-kit--centered',
			'modal-kit--size-m',
			'modal-kit--m-full',
			'modal-kit--anim-fade-rise',
			'has-overlay',
		] );

		removeFilter( 'modalKit.layouts', 'test/gate' );
		expect( resolve( { modalLayout: 'gate' } ).layout ).toBe( 'centered' );
	} );
} );

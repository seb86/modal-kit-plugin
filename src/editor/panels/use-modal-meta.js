/**
 * Reads and writes one of the modal's meta values (triggers, rules,
 * overrides), with defaults from the shared schema.
 */
import { useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';

import schema from '../../../schema/modal-meta.json';

const PREFIX = '_modal_kit_';

/**
 * Fills missing object keys from defaults (lists are kept as stored).
 *
 * @param {unknown} value    Stored value.
 * @param {unknown} defaults Defaults.
 * @return {unknown} Merged value.
 */
export function withDefaults( value, defaults ) {
	if ( value === undefined || value === null || value === '' ) {
		return defaults;
	}

	if (
		Array.isArray( defaults ) ||
		typeof defaults !== 'object' ||
		defaults === null ||
		typeof value !== 'object' ||
		Array.isArray( value )
	) {
		return value;
	}

	const merged = { ...value };

	for ( const [ key, fallback ] of Object.entries( defaults ) ) {
		merged[ key ] = withDefaults( value[ key ], fallback );
	}

	return merged;
}

/**
 * @param {'triggers'|'rules'|'overrides'} key Meta key without prefix.
 * @return {[unknown, (value: unknown) => void]} Value and setter.
 */
export default function useModalMeta( key ) {
	const postType = useSelect(
		( select ) => select( editorStore ).getCurrentPostType(),
		[]
	);
	const [ meta, setMeta ] = useEntityProp( 'postType', postType, 'meta' );
	// Rule defaults depend on site settings (wait days from the setup wizard).
	const defaults =
		key === 'rules' && window.modalKitEditor?.ruleDefaults
			? window.modalKitEditor.ruleDefaults
			: schema[ key ].default;
	const value = withDefaults( meta?.[ PREFIX + key ], defaults );

	const setValue = ( next ) => setMeta( { ...meta, [ PREFIX + key ]: next } );

	return [ value, setValue ];
}

/**
 * Shared pieces of the Settings screen: wp-admin form-table rows and the
 * hook that reads and edits one settings tab through core-data.
 */
import { useEntityRecord } from '@wordpress/core-data';

import schema from '../../../schema/settings.json';

/**
 * Reads and edits one tab's option (e.g. modal_kit_general).
 *
 * @param {string} tab Tab name.
 * @return {[Object, (changes: Object) => void]} Value with defaults, and an updater.
 */
export function useSettingsTab( tab ) {
	const { editedRecord, edit } = useEntityRecord( 'root', 'site' );
	const key = `modal_kit_${ tab }`;
	const value = {
		...schema[ tab ].default,
		...( editedRecord?.[ key ] ?? {} ),
	};

	return [
		value,
		( changes ) => edit( { [ key ]: { ...value, ...changes } } ),
	];
}

/**
 * A row of a wp-admin form table.
 *
 * @param {Object}  props           Props.
 * @param {string}  props.label     Row heading.
 * @param {string}  [props.htmlFor] Id of the main field.
 * @param {Element} props.children  Fields.
 * @return {Element} Row.
 */
export function Row( { label, htmlFor, children } ) {
	return (
		<tr>
			<th scope="row">
				{ htmlFor ? (
					<label htmlFor={ htmlFor }>{ label }</label>
				) : (
					label
				) }
			</th>
			<td>{ children }</td>
		</tr>
	);
}

/**
 * A wp-admin form table with an optional section heading.
 *
 * @param {Object}  props          Props.
 * @param {string}  [props.title]  Section heading.
 * @param {Element} props.children Rows.
 * @return {Element} Section.
 */
export function Section( { title, children } ) {
	return (
		<>
			{ title && <h2 className="title">{ title }</h2> }
			<table className="form-table" role="presentation">
				<tbody>{ children }</tbody>
			</table>
		</>
	);
}

/**
 * Help text under a field.
 *
 * @param {Object}  props          Props.
 * @param {Element} props.children Text.
 * @return {Element} Description.
 */
export function Help( { children } ) {
	return <p className="description">{ children }</p>;
}

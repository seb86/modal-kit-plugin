/**
 * Reopens the pattern picker for the modal being edited ("Change template").
 * The Modal block's toolbar and menu call this; the picker launcher (an
 * editor plugin) listens for the event.
 */
export const OPEN_PICKER_EVENT = 'modal-kit:open-picker';

export function openPicker() {
	window.dispatchEvent( new window.CustomEvent( OPEN_PICKER_EVENT ) );
}

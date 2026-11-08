/**
 * localStorage, namespaced under `modal-kit:`. No cookies, nothing personal.
 * Every access is guarded: storage can be disabled or full.
 *
 * Sites in subfolders share one localStorage, so they add their path, from a
 * meta tag (includes/Storage.php): `modal-kit:/site2/seen`. Pro uses this too.
 */

const PREFIX = 'modal-kit:';

/**
 * This site's path in the keys, empty at the root of a domain.
 *
 * @return {string} Such as `/site2/`.
 */
const scope = () =>
	globalThis.document?.querySelector( 'meta[name="modal-kit-scope"]' )
		?.content ?? '';

/**
 * The full localStorage key on this site.
 *
 * @param {string} key Key without prefix.
 * @return {string} Key.
 */
export const storageKey = ( key ) => PREFIX + scope() + key;

/**
 * Reads a JSON value.
 *
 * @param {string}  key      Key without prefix.
 * @param {unknown} fallback Value when missing or unreadable.
 * @return {unknown} Stored value.
 */
export function read( key, fallback = null ) {
	try {
		const raw = window.localStorage.getItem( storageKey( key ) );
		return raw === null ? fallback : JSON.parse( raw );
	} catch {
		return fallback;
	}
}

/**
 * Writes a JSON value.
 *
 * @param {string}  key   Key without prefix.
 * @param {unknown} value Value.
 */
export function write( key, value ) {
	try {
		window.localStorage.setItem(
			storageKey( key ),
			JSON.stringify( value )
		);
	} catch {}
}

/**
 * Removes a value.
 *
 * @param {string} key Key without prefix.
 */
export function remove( key ) {
	try {
		window.localStorage.removeItem( storageKey( key ) );
	} catch {}
}

/**
 * Removes this site's Modal Kit values ("Reset already seen"), leaving other
 * sites at this address alone.
 */
export function clearAll() {
	const mine = storageKey( '' );
	const others = scope() ? null : `${ PREFIX }/`;

	try {
		Object.keys( window.localStorage )
			.filter(
				( key ) =>
					key.startsWith( mine ) &&
					! ( others && key.startsWith( others ) )
			)
			.forEach( ( key ) => window.localStorage.removeItem( key ) );
	} catch {}
}

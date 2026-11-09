/**
 * Pages for the Display rules: search posts and pages as you type, or
 * type a path. A picked post is saved as "post:123" (matched by ID on the
 * server, so it survives slug changes) and shown by its title. "Homepage"
 * is saved as "/", which matches the front page however it is set up.
 */
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { FormTokenField } from '@wordpress/components';
import { store as coreStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { addQueryArgs } from '@wordpress/url';

const POST_TOKEN = /^post:(\d+)$/;
const HOME = '/';

/**
 * The path of a URL, for telling posts with the same title apart.
 *
 * @param {string} url URL.
 * @return {string} Path.
 */
function pathOf( url ) {
	try {
		return new window.URL( url ).pathname;
	} catch {
		return url;
	}
}

/**
 * Searches public posts of any type.
 *
 * @param {Object} query Search query args.
 * @return {Promise<Object[]>} Results: id, title, url, subtype.
 */
function search( query ) {
	return apiFetch( {
		path: addQueryArgs( '/wp/v2/search', {
			type: 'post',
			subtype: 'any',
			per_page: 10,
			_fields: 'id,title,url,subtype',
			...query,
		} ),
	} );
}

/**
 * @param {Object}                    props          Props.
 * @param {string}                    props.label    Field label.
 * @param {string}                    [props.help]   Help under the field.
 * @param {string[]}                  props.value    Saved entries.
 * @param {(value: string[]) => void} props.onChange Receives the entries.
 * @return {Element} Field.
 */
export default function PageTokens( { label, help, value, onChange } ) {
	const [ results, setResults ] = useState( [] );
	const [ query, setQuery ] = useState( '' );
	const [ offerHome, setOfferHome ] = useState( false );
	const homeLabel = __( 'Homepage', 'modal-kit' );
	const [ known, setKnown ] = useState( {} );
	const typeLabels = useSelect( ( select ) => {
		const labels = {};

		( select( coreStore ).getPostTypes( { per_page: -1 } ) ?? [] ).forEach(
			( type ) => {
				labels[ type.slug ] = type.labels?.singular_name ?? type.name;
			}
		);

		return labels;
	}, [] );

	// "About — Page": what the field shows and matches typing against.
	const baseLabel = ( result ) =>
		sprintf(
			/* translators: 1: post title, 2: post type, e.g. "About — Page". */
			__( '%1$s — %2$s', 'modal-kit' ),
			decodeEntities( result.title ) || __( '(no title)', 'modal-kit' ),
			typeLabels[ result.subtype ] ?? result.subtype
		);

	// Posts sharing a title get their path too, so each label is unique.
	const shared = useMemo( () => {
		const counts = {};
		Object.values( known ).forEach( ( result ) => {
			const base = baseLabel( result );
			counts[ base ] = ( counts[ base ] ?? 0 ) + 1;
		} );
		return counts;
	}, [ known, typeLabels ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const labelOf = ( result ) => {
		const base = baseLabel( result );

		if ( ( shared[ base ] ?? 0 ) < 2 || ! result.url ) {
			return base;
		}

		return sprintf(
			/* translators: 1: label such as "About — Page", 2: its path. */
			__( '%1$s (%2$s)', 'modal-kit' ),
			base,
			pathOf( result.url )
		);
	};

	const remember = ( found ) =>
		setKnown( ( current ) => {
			const next = { ...current };
			found.forEach( ( result ) => {
				next[ `post:${ result.id }` ] = result;
			} );
			return next;
		} );

	// Titles for posts already saved.
	const saved = value
		.map( ( entry ) => POST_TOKEN.exec( entry )?.[ 1 ] )
		.filter( Boolean );
	const missing = saved.filter( ( id ) => ! known[ `post:${ id }` ] );

	useEffect( () => {
		if ( ! missing.length ) {
			return;
		}

		search( { include: missing.join( ',' ), per_page: missing.length } )
			.then( remember )
			.catch( () => {} );
	}, [ missing.join( ',' ) ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Search 250ms after typing stops; a newer query cancels an older one.
	useEffect( () => {
		const typed = query.trim().toLocaleLowerCase();

		// The homepage isn't always a post, so it is offered by name.
		setOfferHome(
			typed.length > 0 && homeLabel.toLocaleLowerCase().includes( typed )
		);

		// Paths are typed, not searched.
		if ( ! typed || typed.startsWith( '/' ) ) {
			setResults( [] );
			return;
		}

		let current = true;
		const timer = window.setTimeout( () => {
			search( { search: query.trim() } )
				.then( ( found ) => {
					if ( current ) {
						remember( found );
						setResults( found );
					}
				} )
				.catch( () => current && setResults( [] ) );
		}, 250 );

		return () => {
			current = false;
			window.clearTimeout( timer );
		};
	}, [ query ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const byLabel = useMemo( () => {
		const map = { [ homeLabel ]: HOME };
		Object.entries( known ).forEach( ( [ token, result ] ) => {
			map[ labelOf( result ) ] = token;
		} );
		return map;
	}, [ known, typeLabels ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const display = ( entry ) => {
		if ( entry === HOME ) {
			return homeLabel;
		}

		return known[ entry ] ? labelOf( known[ entry ] ) : entry;
	};

	return (
		<div className="modal-kit-page-tokens">
			<FormTokenField
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ label }
				value={ value.map( display ) }
				suggestions={ [
					...( offerHome ? [ homeLabel ] : [] ),
					...results.map( labelOf ),
				] }
				onInputChange={ setQuery }
				placeholder={ __( 'Search, or type a path…', 'modal-kit' ) }
				onChange={ ( items ) =>
					onChange(
						items.map( ( item ) => {
							const text = String(
								typeof item === 'string' ? item : item.value
							);
							return byLabel[ text ] ?? text;
						} )
					)
				}
			/>
			{ help && <p className="modal-kit-panel__help">{ help }</p> }
		</div>
	);
}

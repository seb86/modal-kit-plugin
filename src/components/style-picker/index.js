/**
 * The style picker, in the Modal block's Styles tab.
 *
 * Every style is a tile drawn from its own tokens, grouped into "Follows your
 * theme", "{Modal Kit} styles" and "Your styles". The tiles are one radio
 * group with a roving tabindex: hovering or arrowing previews a style on the
 * canvas without saving, click, Enter or Space applies it (one undo step),
 * and mouse-out or Esc reverts. With seven or more styles a search shows;
 * results become list rows with the match marked. The ⋮ menu imports,
 * exports, duplicates and links to Settings → Styles. Styles: _style.scss.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	Modal,
	SearchControl,
	TextControl,
} from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import { moreVertical } from '@wordpress/icons';

import StyleTile from '../style-tile';
import StyleImport from '../style-import';
import { fixedStyles } from '../../styles';

/**
 * The styles that follow the theme.
 *
 * @return {Array<{slug: string, label: string, description: string}>} Styles.
 */
export function themeStyles() {
	return [
		{
			slug: 'default',
			label: __( 'Native', 'modal-kit' ),
			description: __(
				'Your theme’s colours, fonts and corners',
				'modal-kit'
			),
		},
		{
			slug: 'soft',
			label: __( 'Soft', 'modal-kit' ),
			description: __( 'Theme colours, tinted, rounder', 'modal-kit' ),
		},
		{
			slug: 'editorial',
			label: __( 'Editorial', 'modal-kit' ),
			description: __( 'Theme’s dark colour, big type', 'modal-kit' ),
		},
	];
}

/**
 * Every style the picker lists, in groups.
 *
 * @param {Object} fixed fixedStyles().
 * @return {Array<{id: string, label: string, styles: Object[]}>} Groups.
 */
export function styleGroups( fixed ) {
	const entries = Object.entries( fixed ).map( ( [ slug, style ] ) => ( {
		slug,
		label: style.label,
		description: style.description ?? '',
		source: style.source ?? 'builtin',
	} ) );
	const theme = window.modalKitEditor?.themeName ?? '';

	return [
		{
			id: 'theme',
			label: __( 'Follows your theme', 'modal-kit' ),
			note: theme,
			styles: themeStyles(),
		},
		{
			id: 'builtin',
			label: __( 'Modal Kit styles', 'modal-kit' ),
			styles: entries.filter( ( style ) =>
				[ 'builtin', 'plugin' ].includes( style.source )
			),
		},
		{
			id: 'yours',
			label: __( 'Your styles', 'modal-kit' ),
			styles: entries.filter( ( style ) =>
				[ 'yours', 'imported' ].includes( style.source )
			),
		},
	].filter( ( group ) => group.styles.length > 0 );
}

/**
 * Text with the first case-insensitive match wrapped in <mark>.
 *
 * @param {Object} props       Props.
 * @param {string} props.text  Text.
 * @param {string} props.query Search.
 * @return {Element} Text.
 */
function Marked( { text, query } ) {
	const at = query ? text.toLowerCase().indexOf( query.toLowerCase() ) : -1;

	if ( at < 0 ) {
		return text;
	}

	return (
		<>
			{ text.slice( 0, at ) }
			<mark>{ text.slice( at, at + query.length ) }</mark>
			{ text.slice( at + query.length ) }
		</>
	);
}

/**
 * Adds a style's CSS rule to the editor and its canvas, after an import.
 *
 * @param {string} slug Slug.
 * @param {string} css  `.mk-style-{slug}{…}` rule.
 */
export function addStyleRule( slug, css ) {
	const documents = [
		document,
		...[
			...document.querySelectorAll( 'iframe[name="editor-canvas"]' ),
		].map( ( frame ) => frame.contentDocument ),
	].filter( Boolean );

	for ( const doc of documents ) {
		const id = `modal-kit-user-style-${ slug }`;
		const node = doc.getElementById( id ) ?? doc.createElement( 'style' );

		node.id = id;
		node.textContent = css;
		doc.head.appendChild( node );
	}
}

/**
 * Saves text as a download.
 *
 * @param {string} name File name.
 * @param {string} text Contents.
 */
export function download( name, text ) {
	const url = URL.createObjectURL(
		new window.Blob( [ text ], { type: 'application/json' } )
	);
	const link = document.createElement( 'a' );

	link.href = url;
	link.download = name;
	link.click();
	// Revoking straight away can cancel the download in some browsers.
	setTimeout( () => URL.revokeObjectURL( url ), 1000 );
}

/**
 * @param {Object}                  props           Props.
 * @param {string}                  props.value     Applied style slug.
 * @param {(slug: string) => void}  props.onChange  Applies a style.
 * @param {(slug: ?string) => void} props.onPreview Previews one (null reverts).
 * @return {Element} Picker.
 */
export default function StylePicker( { value, onChange, onPreview } ) {
	const [ fixed, setFixed ] = useState( () => ( { ...fixedStyles() } ) );
	const [ query, setQuery ] = useState( '' );
	const [ focused, setFocused ] = useState( null );
	const [ importing, setImporting ] = useState( false );
	const [ duplicating, setDuplicating ] = useState( null );
	const listRef = useRef();
	const editor = window.modalKitEditor ?? {};

	const groups = styleGroups( fixed );
	const all = groups.flatMap( ( group ) => group.styles );
	const searchable = all.length >= 7;
	const needle = searchable ? query.trim().toLowerCase() : '';
	const shown = needle
		? groups
				.map( ( group ) => ( {
					...group,
					styles: group.styles.filter( ( style ) =>
						`${ style.label } ${ style.description }`
							.toLowerCase()
							.includes( needle )
					),
				} ) )
				.filter( ( group ) => group.styles.length > 0 )
		: groups;
	const order = shown.flatMap( ( group ) => group.styles );
	// The tile that takes Tab: the applied one, else the first shown.
	const tabStop = order.some( ( style ) => style.slug === value )
		? value
		: order[ 0 ]?.slug;
	const applied = all.find( ( style ) => style.slug === value );

	const focusTile = ( slug ) => {
		listRef.current?.querySelector( `[data-style="${ slug }"]` )?.focus();
	};

	const onKeyDown = ( event ) => {
		const at = order.findIndex( ( style ) => style.slug === focused );
		let next = null;

		if ( [ 'ArrowRight', 'ArrowDown' ].includes( event.key ) ) {
			next = order[ ( at + 1 ) % order.length ];
		} else if ( [ 'ArrowLeft', 'ArrowUp' ].includes( event.key ) ) {
			next = order[ ( at - 1 + order.length ) % order.length ];
		} else if ( event.key === 'Home' ) {
			next = order[ 0 ];
		} else if ( event.key === 'End' ) {
			next = order[ order.length - 1 ];
		} else if ( event.key === 'Escape' ) {
			event.stopPropagation();
			onPreview( null );
			focusTile( value );
			return;
		}

		if ( next ) {
			event.preventDefault();
			focusTile( next.slug );
			onPreview( next.slug === value ? null : next.slug );
		}
	};

	const apply = ( slug ) => {
		onPreview( null );
		onChange( slug );
	};

	// A new style from the server (import or duplicate): add it and use it.
	const added = ( { item, css } ) => {
		addStyleRule( item.slug, css );

		const tile = { ...item.tile, source: item.source };

		window.modalKitEditor = {
			...editor,
			styles: { ...( editor.styles ?? {} ), [ item.slug ]: tile },
		};
		setFixed( ( current ) => ( { ...current, [ item.slug ]: tile } ) );
		apply( item.slug );
	};

	const exportApplied = async () => {
		const { styles } = await apiFetch( { path: '/modal-kit/v1/styles' } );
		const item = styles.find( ( style ) => style.slug === value );

		if ( item ) {
			download( `${ item.slug }.json`, item.json );
		}
	};

	const radio = ( style, list ) => (
		<div
			key={ style.slug }
			role="radio"
			aria-checked={ style.slug === value }
			aria-label={ style.label }
			aria-describedby={
				style.description
					? `modal-kit-style-about-${ style.slug }`
					: undefined
			}
			tabIndex={ style.slug === tabStop ? 0 : -1 }
			data-style={ style.slug }
			className={ `modal-kit-style-picker__item${
				list ? ' is-row' : ''
			}${ style.slug === value ? ' is-applied' : '' }` }
			onClick={ () => apply( style.slug ) }
			onKeyDown={ ( event ) => {
				if ( [ 'Enter', ' ' ].includes( event.key ) ) {
					event.preventDefault();
					apply( style.slug );
				}
			} }
			onFocus={ () => setFocused( style.slug ) }
			onMouseEnter={ () =>
				onPreview( style.slug === value ? null : style.slug )
			}
		>
			<StyleTile slug={ style.slug } small={ list } />
			<span className="modal-kit-style-picker__name">
				<Marked
					text={ style.label }
					query={ list ? query.trim() : '' }
				/>
				{ style.slug === value && (
					<span
						className="modal-kit-style-picker__check"
						aria-hidden="true"
					>
						✓
					</span>
				) }
			</span>
			{ ! list && style.description && (
				<span
					id={ `modal-kit-style-about-${ style.slug }` }
					className="screen-reader-text"
				>
					{ style.description }
				</span>
			) }
			{ list && style.description && (
				<span
					id={ `modal-kit-style-about-${ style.slug }` }
					className="modal-kit-style-picker__description"
				>
					<Marked text={ style.description } query={ query.trim() } />
				</span>
			) }
		</div>
	);

	return (
		<div className="modal-kit-style-picker">
			<div className="modal-kit-style-picker__bar">
				{ searchable && (
					<SearchControl
						__nextHasNoMarginBottom
						label={ __( 'Search styles', 'modal-kit' ) }
						placeholder={ sprintf(
							/* translators: %d: number of styles. */
							__( 'Search %d styles', 'modal-kit' ),
							all.length
						) }
						value={ query }
						onChange={ setQuery }
						onKeyDown={ ( event ) => {
							if ( event.key === 'Escape' && query ) {
								event.stopPropagation();
								setQuery( '' );
							}
						} }
					/>
				) }
				<DropdownMenu
					icon={ moreVertical }
					label={ __( 'Style actions', 'modal-kit' ) }
					// As tall as the search field beside it.
					toggleProps={ { __next40pxDefaultSize: true } }
				>
					{ ( { onClose } ) => (
						<MenuGroup>
							{ editor.canManageStyles && (
								<MenuItem
									onClick={ () => {
										onClose();
										setImporting( true );
									} }
									suffix=".json"
								>
									{ __( 'Import style…', 'modal-kit' ) }
								</MenuItem>
							) }
							{ editor.canManageStyles && fixed[ value ] && (
								<MenuItem
									onClick={ () => {
										onClose();
										exportApplied();
									} }
								>
									{ sprintf(
										/* translators: %s: style name. */
										__( 'Export “%s”', 'modal-kit' ),
										applied?.label ?? ''
									) }
								</MenuItem>
							) }
							{ editor.canManageStyles && fixed[ value ] && (
								<MenuItem
									onClick={ () => {
										onClose();
										setDuplicating( {
											label: sprintf(
												/* translators: %s: style name. */
												__( '%s copy', 'modal-kit' ),
												applied?.label ?? ''
											),
											description:
												applied?.description ?? '',
										} );
									} }
								>
									{ __(
										'Duplicate as new style',
										'modal-kit'
									) }
								</MenuItem>
							) }
							{ editor.stylesUrl && (
								<MenuItem href={ editor.stylesUrl }>
									{ __( 'Manage styles…', 'modal-kit' ) }
								</MenuItem>
							) }
						</MenuGroup>
					) }
				</DropdownMenu>
			</div>

			{ needle && (
				<p className="modal-kit-style-picker__count" role="status">
					{ sprintf(
						/* translators: 1: styles shown, 2: all styles. */
						_n(
							'%1$d of %2$d style',
							'%1$d of %2$d styles',
							all.length,
							'modal-kit'
						),
						order.length,
						all.length
					) }
				</p>
			) }

			{  }
			<div
				ref={ listRef }
				role="radiogroup"
				aria-label={ __( 'Style', 'modal-kit' ) }
				// The tiles take focus (roving tabindex), not the group.
				tabIndex={ -1 }
				className="modal-kit-style-picker__groups"
				onKeyDown={ onKeyDown }
				onMouseLeave={ () => onPreview( null ) }
				onBlur={ ( event ) => {
					if (
						! event.currentTarget.contains( event.relatedTarget )
					) {
						onPreview( null );
					}
				} }
			>
				{ shown.map( ( group ) => (
					<div
						key={ group.id }
						className="modal-kit-style-picker__group"
						role="group"
						aria-label={ group.label }
					>
						<span className="modal-kit-style-picker__label">
							{ group.label }
							{ group.note && (
								<span className="modal-kit-style-picker__note">
									{ group.note }
								</span>
							) }
						</span>
						<div
							className={
								needle
									? 'modal-kit-style-picker__rows'
									: 'modal-kit-style-picker__tiles'
							}
						>
							{ group.styles.map( ( style ) =>
								radio( style, !! needle )
							) }
						</div>
					</div>
				) ) }
			</div>

			{ needle && order.length === 0 && (
				<p className="modal-kit-style-picker__empty">
					{ sprintf(
						/* translators: %s: search text. */
						__( 'No styles match “%s”.', 'modal-kit' ),
						query.trim()
					) }{ ' ' }
					{ editor.canManageStyles && (
						<Button
							variant="link"
							onClick={ () => setImporting( true ) }
						>
							{ __( 'Import a style', 'modal-kit' ) }
						</Button>
					) }
				</p>
			) }

			{ importing && (
				<StyleImport
					submitLabel={ __( 'Import and apply', 'modal-kit' ) }
					manageUrl={ editor.stylesUrl }
					onClose={ () => setImporting( false ) }
					onImported={ ( result ) => {
						setImporting( false );
						added( result );
					} }
				/>
			) }

			{ duplicating && (
				<Modal
					title={ __( 'Duplicate as new style', 'modal-kit' ) }
					onRequestClose={ () => setDuplicating( null ) }
					size="small"
				>
					<form
						className="modal-kit-style-duplicate"
						onSubmit={ ( event ) => {
							event.preventDefault();
							apiFetch( {
								path: `/modal-kit/v1/styles/${ value }/duplicate`,
								method: 'POST',
								data: duplicating,
							} ).then( ( result ) => {
								setDuplicating( null );
								added( result );
							} );
						} }
					>
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'Name', 'modal-kit' ) }
							value={ duplicating.label }
							onChange={ ( label ) =>
								setDuplicating( { ...duplicating, label } )
							}
						/>
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'Description', 'modal-kit' ) }
							value={ duplicating.description }
							onChange={ ( description ) =>
								setDuplicating( {
									...duplicating,
									description,
								} )
							}
						/>
						<Button
							variant="primary"
							type="submit"
							disabled={ ! duplicating.label.trim() }
						>
							{ __( 'Duplicate and apply', 'modal-kit' ) }
						</Button>
					</form>
				</Modal>
			) }
		</div>
	);
}

/**
 * Settings → Styles: every fixed style with its source and the
 * modals that use it. Export one as .json or several (optionally with their
 * font files) as .zip, copy the JSON, duplicate any style, delete your own
 * after choosing where the modals that use it go. Built-in styles can't be
 * deleted. Modal Kit Pro adds the Style editor through the
 * `modalKit.styleEditor` filter (New style, Edit, Edit a copy); without it,
 * a dismissible note says what it does (listing `style-editor`, #133).
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	CheckboxControl,
	Modal,
	Notice,
	SelectControl,
	Spinner,
	TextControl,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';

import StyleTile from '../../components/style-tile';
import StyleImport from '../../components/style-import';
import { download, themeStyles } from '../../components/style-picker';

const SOURCES = {
	builtin: __( 'Built in', 'modal-kit' ),
	yours: __( 'Yours', 'modal-kit' ),
	imported: __( 'Imported', 'modal-kit' ),
	plugin: __( 'Added by a plugin', 'modal-kit' ),
};

const OWN = [ 'yours', 'imported' ];

/**
 * Hides a Pro listing for good for the current user.
 *
 * @param {string} key Listing key.
 */
function dismissForGood( key ) {
	const settings = window.modalKitSettings ?? {};
	const dismissed = { ...( settings.dismissed ?? {} ), [ key ]: 4102444800 };

	settings.dismissed = dismissed;
	apiFetch( {
		path: '/wp/v2/users/me',
		method: 'POST',
		data: { meta: { modal_kit_dismissed: dismissed } },
	} ).catch( () => {} );
}

export default function Styles( { notify } ) {
	const [ styles, setStyles ] = useState( null );
	const [ selected, setSelected ] = useState( [] );
	const [ fonts, setFonts ] = useState( false );
	const [ importing, setImporting ] = useState( false );
	const [ duplicating, setDuplicating ] = useState( null );
	const [ deleting, setDeleting ] = useState( null );
	const [ editing, setEditing ] = useState( null );
	const [ error, setError ] = useState( '' );
	const settings = window.modalKitSettings ?? {};
	const [ note, setNote ] = useState( () =>
		( settings.proListings ?? [] ).find(
			( listing ) => listing.key === 'style-editor'
		)
	);

	/**
	 * The Pro Style editor: a component taking { style, slug, usedBy,
	 * styles, onClose, onSaved }, where slug is empty for a new style.
	 */
	const StyleEditor = applyFilters( 'modalKit.styleEditor', null );

	const load = () =>
		apiFetch( { path: '/modal-kit/v1/styles' } )
			.then( ( result ) => {
				setStyles( result.styles );
				// Tiles read fixedStyles(); keep it current after changes.
				window.modalKitSettings = {
					...( window.modalKitSettings ?? {} ),
					styles: Object.fromEntries(
						result.styles.map( ( item ) => [
							item.slug,
							item.tile,
						] )
					),
				};
			} )
			.catch( ( failure ) => setError( failure.message ) );

	useEffect( () => {
		load();
	}, [] );

	if ( ! styles ) {
		return error ? (
			<Notice status="error" isDismissible={ false }>
				{ error }
			</Notice>
		) : (
			<Spinner />
		);
	}

	const toggle = ( slug, on ) =>
		setSelected(
			on ? [ ...selected, slug ] : selected.filter( ( s ) => s !== slug )
		);

	// One style without fonts is a .json; anything else is a .zip.
	const exportStyles = ( slugs ) => {
		if ( slugs.length === 1 && ! fonts ) {
			const item = styles.find( ( style ) => style.slug === slugs[ 0 ] );
			download( `${ item.slug }.json`, item.json );
			return;
		}

		const url = new URL( settings.exportUrl, window.location.href );
		url.searchParams.set( 'styles', slugs.join( ',' ) );

		if ( fonts ) {
			url.searchParams.set( 'fonts', '1' );
		}

		window.location.assign( url.toString() );
	};

	const first = styles.find( ( style ) => style.slug === selected[ 0 ] );

	const remove = async ( item, reassign = '' ) => {
		try {
			await apiFetch( {
				path: `/modal-kit/v1/styles/${ item.slug }${
					reassign ? `?reassign=${ reassign }` : ''
				}`,
				method: 'DELETE',
			} );
			setDeleting( null );
			setSelected( selected.filter( ( s ) => s !== item.slug ) );
			notify(
				'success',
				sprintf(
					/* translators: %s: style name. */
					__( '“%s” deleted.', 'modal-kit' ),
					item.label
				)
			);
			load();
		} catch ( failure ) {
			setError( failure.message );
		}
	};

	return (
		<div className="modal-kit-styles">
			<h2 className="title">{ __( 'Styles', 'modal-kit' ) }</h2>
			<p>
				{ __(
					'Styles that bring their own colours, fonts and corners. Import one from a .json file, or export yours to use on another site.',
					'modal-kit'
				) }
			</p>
			{ error && (
				<Notice status="error" onRemove={ () => setError( '' ) }>
					{ error }
				</Notice>
			) }

			{ ! StyleEditor && note && (
				<Notice
					status="info"
					className="modal-kit-styles__pro"
					onRemove={ () => {
						dismissForGood( note.key );
						setNote( null );
					} }
				>
					<b>
						{ note.title }{ ' ' }
						<span className="modal-kit-styles__badge">Pro</span>
					</b>{ ' ' }
					{ note.description }{ ' ' }
					<a href={ note.url } target="_blank" rel="noreferrer">
						{ __( 'Learn more', 'modal-kit' ) }
						<span className="screen-reader-text">
							{ __( '(opens in a new tab)', 'modal-kit' ) }
						</span>
					</a>
				</Notice>
			) }

			<div className="modal-kit-styles__bar">
				{ StyleEditor && (
					<Button
						variant="primary"
						onClick={ () => {
							const base = styles.find(
								( item ) => item.slug === 'fieldnote'
							);

							setEditing( {
								slug: '',
								usedBy: 0,
								style: {
									...JSON.parse( base?.json ?? '{}' ),
									slug: '',
									label: __( 'New style', 'modal-kit' ),
									description: '',
								},
							} );
						} }
					>
						{ __( 'New style', 'modal-kit' ) }
					</Button>
				) }
				<Button
					variant="secondary"
					onClick={ () => setImporting( true ) }
				>
					{ __( 'Import', 'modal-kit' ) }
				</Button>
				{ selected.length > 0 && (
					<>
						<span>
							{ sprintf(
								/* translators: %d: number of styles. */
								_n(
									'%d selected',
									'%d selected',
									selected.length,
									'modal-kit'
								),
								selected.length
							) }
						</span>
						<Button
							variant="primary"
							onClick={ () => exportStyles( selected ) }
						>
							{ selected.length > 1 || fonts
								? __( 'Export selected (.zip)', 'modal-kit' )
								: __( 'Export selected (.json)', 'modal-kit' ) }
						</Button>
					</>
				) }
			</div>

			<table className="widefat striped modal-kit-styles__table">
				<thead>
					<tr>
						<td className="check-column">
							<span className="screen-reader-text">
								{ __( 'Select', 'modal-kit' ) }
							</span>
						</td>
						<th scope="col">{ __( 'Style', 'modal-kit' ) }</th>
						<th scope="col">{ __( 'Source', 'modal-kit' ) }</th>
						<th scope="col">{ __( 'Used by', 'modal-kit' ) }</th>
						<th scope="col">
							<span className="screen-reader-text">
								{ __( 'Actions', 'modal-kit' ) }
							</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{ styles.map( ( item ) => (
						<tr key={ item.slug }>
							<td className="check-column">
								<CheckboxControl
									__nextHasNoMarginBottom
									label={
										<span className="screen-reader-text">
											{ sprintf(
												/* translators: %s: style name. */
												__( 'Select %s', 'modal-kit' ),
												item.label
											) }
										</span>
									}
									checked={ selected.includes( item.slug ) }
									onChange={ ( on ) =>
										toggle( item.slug, on )
									}
								/>
							</td>
							<th scope="row">
								<div className="modal-kit-styles__name">
									<StyleTile slug={ item.slug } small />
									<span>
										<b>{ item.label }</b>
										<span className="description">
											{ item.from
												? sprintf(
														/* translators: %s: style name. */
														__(
															'Duplicated from %s',
															'modal-kit'
														),
														styles.find(
															( s ) =>
																s.slug ===
																item.from
														)?.label ?? item.from
													)
												: item.description }
										</span>
									</span>
								</div>
							</th>
							<td>{ SOURCES[ item.source ] ?? item.source }</td>
							<td>
								{ item.usedBy
									? sprintf(
											/* translators: %d: number of modals. */
											_n(
												'%d modal',
												'%d modals',
												item.usedBy,
												'modal-kit'
											),
											item.usedBy
										)
									: '—' }
							</td>
							<td className="modal-kit-styles__actions">
								<Button
									variant="link"
									onClick={ () => {
										const json = styles.find(
											( s ) => s.slug === item.slug
										).json;
										download( `${ item.slug }.json`, json );
									} }
								>
									{ __( 'Export', 'modal-kit' ) }
								</Button>
								{ OWN.includes( item.source ) ? (
									<>
										{ StyleEditor && (
											<Button
												variant="link"
												onClick={ () =>
													setEditing( {
														slug: item.slug,
														usedBy: item.usedBy,
														style: JSON.parse(
															item.json
														),
													} )
												}
											>
												{ __( 'Edit', 'modal-kit' ) }
											</Button>
										) }
										<Button
											variant="link"
											isDestructive
											onClick={ () =>
												item.usedBy
													? setDeleting( {
															item,
															to: 'default',
														} )
													: remove( item )
											}
										>
											{ __( 'Delete', 'modal-kit' ) }
										</Button>
									</>
								) : (
									<>
										{ StyleEditor && (
											<Button
												variant="link"
												onClick={ () =>
													setEditing( {
														slug: '',
														usedBy: 0,
														style: {
															...JSON.parse(
																item.json
															),
															slug: '',
															label: sprintf(
																/* translators: %s: style name. */
																__(
																	'%s copy',
																	'modal-kit'
																),
																item.label
															),
														},
													} )
												}
											>
												{ __(
													'Edit a copy',
													'modal-kit'
												) }
											</Button>
										) }
										<Button
											variant="link"
											onClick={ () =>
												setDuplicating( {
													slug: item.slug,
													label: sprintf(
														/* translators: %s: style name. */
														__(
															'%s copy',
															'modal-kit'
														),
														item.label
													),
													description:
														item.description,
												} )
											}
										>
											{ __( 'Duplicate', 'modal-kit' ) }
										</Button>
									</>
								) }
							</td>
						</tr>
					) ) }
				</tbody>
			</table>

			{ StyleEditor && editing && (
				<StyleEditor
					style={ editing.style }
					slug={ editing.slug }
					usedBy={ editing.usedBy }
					styles={ styles }
					onClose={ () => setEditing( null ) }
					onSaved={ ( item ) => {
						setEditing( null );
						notify(
							'success',
							sprintf(
								/* translators: %s: style name. */
								__( '“%s” saved.', 'modal-kit' ),
								item.label
							)
						);
						load();
					} }
				/>
			) }

			<div className="modal-kit-styles__export">
				<h3>{ __( 'Export options', 'modal-kit' ) }</h3>
				<CheckboxControl
					__nextHasNoMarginBottom
					label={ __( 'Include font files', 'modal-kit' ) }
					help={ __(
						'Adds the .woff2 files the style uses. Leave off for fonts that can’t be shared.',
						'modal-kit'
					) }
					checked={ fonts }
					onChange={ setFonts }
				/>
				{ first && (
					<>
						<pre className="modal-kit-styles__json">
							{ first.json }
						</pre>
						<Button
							variant="secondary"
							onClick={ () =>
								window.navigator.clipboard
									?.writeText( first.json )
									.then( () =>
										notify(
											'success',
											__( 'JSON copied.', 'modal-kit' )
										)
									)
							}
						>
							{ __( 'Copy JSON to clipboard', 'modal-kit' ) }
						</Button>
					</>
				) }
				<p className="description">
					{ __(
						'One style: .json · several or with fonts: .zip',
						'modal-kit'
					) }
				</p>
			</div>

			{ importing && (
				<StyleImport
					onClose={ () => setImporting( false ) }
					onImported={ ( { item } ) => {
						setImporting( false );
						notify(
							'success',
							sprintf(
								/* translators: %s: style name. */
								__( '“%s” imported.', 'modal-kit' ),
								item.label
							)
						);
						load();
					} }
				/>
			) }

			{ duplicating && (
				<Modal
					title={ __( 'Duplicate style', 'modal-kit' ) }
					onRequestClose={ () => setDuplicating( null ) }
					size="small"
				>
					<form
						className="modal-kit-style-duplicate"
						onSubmit={ ( event ) => {
							event.preventDefault();
							apiFetch( {
								path: `/modal-kit/v1/styles/${ duplicating.slug }/duplicate`,
								method: 'POST',
								data: {
									label: duplicating.label,
									description: duplicating.description,
								},
							} ).then( () => {
								setDuplicating( null );
								load();
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
							{ __( 'Duplicate', 'modal-kit' ) }
						</Button>
					</form>
				</Modal>
			) }

			{ deleting && (
				<Modal
					title={ sprintf(
						/* translators: %s: style name. */
						__( 'Delete “%s”?', 'modal-kit' ),
						deleting.item.label
					) }
					onRequestClose={ () => setDeleting( null ) }
					size="small"
				>
					<div className="modal-kit-style-duplicate">
						<p>
							{ sprintf(
								/* translators: %d: number of modals. */
								_n(
									'%d modal uses this style. Choose the style it switches to.',
									'%d modals use this style. Choose the style they switch to.',
									deleting.item.usedBy,
									'modal-kit'
								),
								deleting.item.usedBy
							) }
						</p>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'Switch them to', 'modal-kit' ) }
							value={ deleting.to }
							options={ [
								...themeStyles().map( ( style ) => ( {
									value: style.slug,
									label: style.label,
								} ) ),
								...styles
									.filter(
										( style ) =>
											style.slug !== deleting.item.slug
									)
									.map( ( style ) => ( {
										value: style.slug,
										label: style.label,
									} ) ),
							] }
							onChange={ ( to ) =>
								setDeleting( { ...deleting, to } )
							}
						/>
						<Button
							variant="primary"
							isDestructive
							onClick={ () =>
								remove( deleting.item, deleting.to )
							}
						>
							{ __( 'Switch and delete', 'modal-kit' ) }
						</Button>
					</div>
				</Modal>
			) }
		</div>
	);
}

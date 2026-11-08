/**
 * Import a style (mockup 14c): reads a .json file, draws its tile, lets the
 * name and description change, and runs the checks before saving: what was
 * found and filled in from Fieldnote, the contrast test (a warning: low
 * contrast can still be imported, #137), fonts the site doesn't have, and a
 * name that's taken. The server
 * runs the same checks again (StyleSchema.php) and decides.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	FormFileUpload,
	Modal,
	Notice,
	RadioControl,
	TextControl,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';

import StyleTile from '../style-tile';
import {
	contrastCheck,
	freeSlug,
	readStyle,
	slugify,
} from '../../styles/schema';

const THEME = [ 'default', 'soft', 'editorial' ];

/**
 * A clean style as a tile draws it.
 *
 * @param {Object} style Clean style.
 * @return {Object} Tile tokens.
 */
export function tileOf( style ) {
	return {
		surface: style.color.surface,
		ink: style.color.ink,
		accent: style.color.accent,
		onAccent: style.color[ 'on-accent' ],
		head: style.font?.head ?? '',
		headWeight: String( style.font?.[ 'head-weight' ] ?? '' ),
		headTracking: style.font?.[ 'head-tracking' ] ?? '',
		radiusPanel: style.radius?.panel ?? '',
		radiusButton: style.radius?.button ?? '',
	};
}

/**
 * Fonts of a style the site doesn't have, and what shows instead.
 *
 * @param {Object}   style Clean style.
 * @param {string[]} have  Font families the site has.
 * @return {Array<{font: string, fallback: string}>} Missing fonts.
 */
export function missingFonts( style, have ) {
	const known = have.map( ( name ) => name.toLowerCase() );
	const generic = [
		'serif',
		'sans-serif',
		'monospace',
		'system-ui',
		'cursive',
	];
	const missing = [];

	for ( const key of [ 'head', 'body' ] ) {
		const stack = String( style.font?.[ key ] ?? '' ).split( ',' );
		const first = stack[ 0 ].trim().replace( /^['"]|['"]$/g, '' );

		if (
			first &&
			! generic.includes( first.toLowerCase() ) &&
			! known.includes( first.toLowerCase() ) &&
			! missing.some( ( item ) => item.font === first )
		) {
			missing.push( {
				font: first,
				fallback: ( stack[ 1 ] ?? 'sans-serif' )
					.trim()
					.replace( /^['"]|['"]$/g, '' ),
			} );
		}
	}

	return missing;
}

function Check( { status, children } ) {
	const mark = { ok: '✓', warn: '!', fail: '✕' }[ status ];

	return (
		<li className={ `modal-kit-style-import__check is-${ status }` }>
			<span aria-hidden="true">{ mark }</span>
			<span>{ children }</span>
		</li>
	);
}

/**
 * @param {Object}                   props               Props.
 * @param {() => void}               props.onClose       Closes the dialog.
 * @param {(result: Object) => void} props.onImported    Receives the server's answer ({ item, css }).
 * @param {string}                   [props.submitLabel] Button label ("Import and apply" in the editor).
 * @param {string}                   [props.manageUrl]   Settings → Styles, for fixing a failed check.
 * @return {Element} Dialog.
 */
export default function StyleImport( {
	onClose,
	onImported,
	submitLabel = __( 'Import', 'modal-kit' ),
	manageUrl = '',
} ) {
	const [ file, setFile ] = useState( null );
	const [ raw, setRaw ] = useState( null );
	const [ label, setLabel ] = useState( '' );
	const [ description, setDescription ] = useState( '' );
	const [ mode, setMode ] = useState( 'copy' );
	const [ library, setLibrary ] = useState( null );
	const [ error, setError ] = useState( '' );
	const [ busy, setBusy ] = useState( false );

	useEffect( () => {
		apiFetch( { path: '/modal-kit/v1/styles' } )
			.then( setLibrary )
			.catch( () => setLibrary( { styles: [], fonts: [] } ) );
	}, [] );

	const read = raw ? readStyle( raw ) : null;
	const style = read?.style
		? { ...read.style, label: label || read.style.label, description }
		: null;
	const contrast = style ? contrastCheck( style ) : null;
	const fonts =
		style && library ? missingFonts( style, library.fonts ?? [] ) : [];
	const existing = style
		? ( library?.styles ?? [] ).find(
				( item ) =>
					item.slug === ( read.style.slug || slugify( style.label ) )
			)
		: null;
	const clashesTheme = style && THEME.includes( read.style.slug );
	const replaceable =
		existing && [ 'yours', 'imported' ].includes( existing.source );
	const renamed =
		style && ( existing || clashesTheme )
			? freeSlug(
					read.style.slug || slugify( style.label ),
					style.label,
					[
						...THEME,
						...( library?.styles ?? [] ).map(
							( item ) => item.slug
						),
					]
				)
			: null;

	const choose = ( files ) => {
		const chosen = files?.[ 0 ];

		if ( ! chosen ) {
			return;
		}

		setError( '' );
		setFile( chosen );
		chosen
			.text()
			.then( ( text ) => {
				const parsed = JSON.parse( text );
				const result = readStyle( parsed );

				if ( result.error === 'not-a-style' ) {
					throw new Error( 'not a style' );
				}

				setRaw( parsed );
				setLabel( result.style.label );
				setDescription( result.style.description );
				setMode( 'copy' );
			} )
			.catch( () => {
				setRaw( null );
				setError(
					__(
						'This file isn’t a Modal Kit style. Choose a .json file exported from Modal Kit.',
						'modal-kit'
					)
				);
			} );
	};

	const save = async () => {
		setBusy( true );
		setError( '' );

		try {
			const result = await apiFetch( {
				path: '/modal-kit/v1/styles',
				method: 'POST',
				data: {
					style: raw,
					label: style.label,
					description,
					mode: replaceable ? mode : 'copy',
				},
			} );
			onImported( result );
		} catch ( failure ) {
			setError( failure.message );
			setBusy( false );
		}
	};

	const colours = read?.found?.color ?? 0;
	const corners = read?.found?.radius ?? 0;

	return (
		<Modal
			title={ __( 'Import a style', 'modal-kit' ) }
			onRequestClose={ onClose }
			className="modal-kit-style-import"
		>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }

			<div className="modal-kit-style-import__file">
				<span>
					{ file
						? sprintf(
								/* translators: 1: file name, 2: size in KB. */
								__( '%1$s · %2$s KB', 'modal-kit' ),
								file.name,
								( file.size / 1024 ).toFixed( 1 )
							)
						: __(
								'A .json file exported from Modal Kit.',
								'modal-kit'
							) }
				</span>
				<FormFileUpload
					accept=".json,application/json"
					onChange={ ( event ) =>
						choose( event.currentTarget.files )
					}
					render={ ( { openFileDialog } ) => (
						<Button variant="secondary" onClick={ openFileDialog }>
							{ file
								? __( 'Choose another', 'modal-kit' )
								: __( 'Choose a file', 'modal-kit' ) }
						</Button>
					) }
				/>
			</div>

			{ style && (
				<>
					<div className="modal-kit-style-import__about">
						<StyleTile tokens={ tileOf( style ) } />
						<div className="modal-kit-style-import__fields">
							<TextControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __( 'Name', 'modal-kit' ) }
								value={ label }
								onChange={ setLabel }
							/>
							<TextControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __( 'Description', 'modal-kit' ) }
								help={ __(
									'Used by search. Optional.',
									'modal-kit'
								) }
								value={ description }
								onChange={ setDescription }
							/>
						</div>
					</div>

					<h3 className="modal-kit-style-import__heading">
						{ __( 'Checks', 'modal-kit' ) }
					</h3>
					<ul className="modal-kit-style-import__checks">
						<Check
							status={
								read.missing.length || read.invalid.length
									? 'warn'
									: 'ok'
							}
						>
							{ sprintf(
								/* translators: 1: colours found, 2: corner sizes found. */
								__(
									'%1$d of 13 colours and %2$d of 3 corner sizes found',
									'modal-kit'
								),
								colours,
								corners
							) }
							{ read.missing.length > 0 && (
								<span className="modal-kit-style-import__detail">
									{ sprintf(
										/* translators: %s: list of missing tokens. */
										__(
											'Missing, so Fieldnote’s is used: %s',
											'modal-kit'
										),
										read.missing.join( ', ' )
									) }
								</span>
							) }
							{ read.invalid.length > 0 && (
								<span className="modal-kit-style-import__detail">
									{ sprintf(
										/* translators: %s: list of tokens. */
										__(
											'Not a colour or length, so Fieldnote’s is used: %s',
											'modal-kit'
										),
										read.invalid.join( ', ' )
									) }
								</span>
							) }
							{ read.ignored.length > 0 && (
								<span className="modal-kit-style-import__detail">
									{ sprintf(
										/* translators: %s: list of keys. */
										__( 'Ignored: %s', 'modal-kit' ),
										read.ignored.join( ', ' )
									) }
								</span>
							) }
						</Check>
						<Check status={ contrast.pass ? 'ok' : 'warn' }>
							{ contrast.pass
								? __( 'Contrast passes', 'modal-kit' )
								: __(
										'Some text may be hard to read. You can still import it.',
										'modal-kit'
									) }
							<span className="modal-kit-style-import__detail">
								{ contrast.pass
									? sprintf(
											/* translators: 1: body text ratio, 2: button text ratio, 3: muted text ratio. */
											__(
												'Body text %1$s:1 · button text %2$s:1 · muted text %3$s:1',
												'modal-kit'
											),
											contrast.summary.body.toFixed( 1 ),
											contrast.summary.button.toFixed(
												1
											),
											contrast.summary.muted.toFixed( 1 )
										)
									: contrast.failures
											.map( ( item ) =>
												sprintf(
													/* translators: 1: text colour token, 2: background token, 3: ratio, 4: minimum. */
													__(
														'%1$s on %2$s: %3$s:1 (needs %4$s:1)',
														'modal-kit'
													),
													item.fg,
													item.bg,
													item.ratio.toFixed( 1 ),
													item.min
												)
											)
											.join( ' · ' ) }
								{ ! contrast.pass && manageUrl && (
									<>
										{ ' ' }
										<a href={ manageUrl }>
											{ __(
												'Adjust it in Manage styles',
												'modal-kit'
											) }
										</a>
									</>
								) }
							</span>
						</Check>
						{ fonts.map( ( item ) => (
							<Check status="warn" key={ item.font }>
								{ sprintf(
									/* translators: %s: font family. */
									__(
										'Font “%s” isn’t on this site',
										'modal-kit'
									),
									item.font
								) }
								<span className="modal-kit-style-import__detail">
									{ sprintf(
										/* translators: %s: fallback font family. */
										__(
											'%s is used until you upload it in Appearance → Fonts.',
											'modal-kit'
										),
										item.fallback
									) }
								</span>
							</Check>
						) ) }
						{ renamed && (
							<Check status="warn">
								{ sprintf(
									/* translators: %s: style name. */
									__(
										'A style called “%s” already exists',
										'modal-kit'
									),
									existing?.label ?? style.label
								) }
								{ replaceable ? (
									<RadioControl
										className="modal-kit-style-import__clash"
										selected={ mode }
										options={ [
											{
												value: 'copy',
												label: sprintf(
													/* translators: %s: new style name. */
													__(
														'Import as “%s”',
														'modal-kit'
													),
													renamed.label
												),
											},
											{
												value: 'replace',
												label: sprintf(
													/* translators: %d: number of modals. */
													_n(
														'Replace it (%d modal uses it)',
														'Replace it (%d modals use it)',
														existing.usedBy,
														'modal-kit'
													),
													existing.usedBy
												),
											},
										] }
										onChange={ setMode }
									/>
								) : (
									<span className="modal-kit-style-import__detail">
										{ sprintf(
											/* translators: %s: new style name. */
											__(
												'It’s imported as “%s”.',
												'modal-kit'
											),
											renamed.label
										) }
									</span>
								) }
							</Check>
						) }
					</ul>
				</>
			) }

			<div className="modal-kit-style-import__actions">
				<Button variant="tertiary" onClick={ onClose }>
					{ __( 'Cancel', 'modal-kit' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ save }
					isBusy={ busy }
					disabled={ ! style || ! style.label || busy }
					accessibleWhenDisabled
				>
					{ submitLabel }
				</Button>
			</div>
		</Modal>
	);
}

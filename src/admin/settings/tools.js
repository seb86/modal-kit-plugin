/**
 * Tools tab: export / import, testing helpers, uninstall.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	CheckboxControl,
	DropZone,
	FormFileUpload,
	ToggleControl,
} from '@wordpress/components';
import { applyFilters } from '@wordpress/hooks';
import { useState } from '@wordpress/element';

import { clearAll } from '../../runtime/storage';
import { Help, Row, Section, useSettingsTab } from './components';

export default function Tools( { notify } ) {
	const [ tools, update ] = useSettingsTab( 'tools' );
	const [ withSettings, setWithSettings ] = useState( true );
	const [ replace, setReplace ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const modals = window.modalKitSettings?.site?.modals ?? 0;

	const download = async () => {
		setBusy( true );
		try {
			const data = await apiFetch( {
				path: `/modal-kit/v1/export?settings=${ withSettings ? 1 : 0 }`,
			} );
			const blob = new window.Blob( [ JSON.stringify( data, null, 2 ) ], {
				type: 'application/json',
			} );
			const link = document.createElement( 'a' );
			link.href = window.URL.createObjectURL( blob );
			link.download = `modal-kit-${ new Date().toISOString().slice( 0, 10 ) }.json`;
			link.click();
			window.URL.revokeObjectURL( link.href );
		} catch ( error ) {
			notify( 'error', error.message );
		}
		setBusy( false );
	};

	const importFile = async ( file ) => {
		if ( ! file ) {
			return;
		}

		setBusy( true );
		try {
			const data = JSON.parse( await file.text() );
			const result = await apiFetch( {
				path: '/modal-kit/v1/import',
				method: 'POST',
				data: { data, replace },
			} );
			notify(
				'success',
				sprintf(
					/* translators: 1: created, 2: updated, 3: skipped. */
					__(
						'Imported: %1$d new, %2$d updated, %3$d skipped.',
						'modal-kit'
					),
					result.created,
					result.updated,
					result.skipped
				) +
					( result.settings
						? ' ' +
							__(
								'Settings imported. Reload to see them.',
								'modal-kit'
							)
						: '' )
			);
		} catch ( error ) {
			notify(
				'error',
				error instanceof SyntaxError
					? __( 'That file isn’t valid JSON.', 'modal-kit' )
					: error.message
			);
		}
		setBusy( false );
	};

	/**
	 * Extra rows for the Tools tab (the setup wizard adds "Run setup again").
	 */
	const extraRows = applyFilters( 'modalKit.toolsRows', [] );

	return (
		<>
			<Section>
				<Row label={ __( 'Export', 'modal-kit' ) }>
					<p>
						{ __(
							'Download modals with their triggers and rules, to move them between sites.',
							'modal-kit'
						) }
					</p>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ sprintf(
							/* translators: %d: number of modals. */
							_n(
								'All modals (%d)',
								'All modals (%d)',
								modals,
								'modal-kit'
							),
							modals
						) }
						checked
						disabled
						onChange={ () => {} }
					/>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( 'Include settings', 'modal-kit' ) }
						checked={ withSettings }
						onChange={ setWithSettings }
					/>
					<Button
						variant="secondary"
						onClick={ download }
						disabled={ busy }
						__next40pxDefaultSize
					>
						{ __( 'Download .json', 'modal-kit' ) }
					</Button>
				</Row>
				<Row label={ __( 'Import', 'modal-kit' ) }>
					<div className="modal-kit-dropzone">
						<p>
							{ __(
								'Drop a Modal Kit .json file here, or',
								'modal-kit'
							) }{ ' ' }
							<FormFileUpload
								accept="application/json,.json"
								onChange={ ( event ) =>
									importFile( event.target.files?.[ 0 ] )
								}
								render={ ( { openFileDialog } ) => (
									<Button
										variant="link"
										onClick={ openFileDialog }
										disabled={ busy }
									>
										{ __( 'choose a file', 'modal-kit' ) }
									</Button>
								) }
							/>
						</p>
						<DropZone
							onFilesDrop={ ( files ) =>
								importFile( files[ 0 ] )
							}
						/>
					</div>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __(
							'Replace modals with the same slug',
							'modal-kit'
						) }
						checked={ replace }
						onChange={ setReplace }
					/>
				</Row>
				<Row label={ __( 'Testing', 'modal-kit' ) }>
					<Button
						variant="secondary"
						onClick={ () => {
							clearAll();
							notify(
								'success',
								__(
									'This browser will see every modal again as a first-time visitor.',
									'modal-kit'
								)
							);
						} }
						__next40pxDefaultSize
					>
						{ __(
							'Reset “already seen” for my browser',
							'modal-kit'
						) }
					</Button>
					<Help>
						{ __(
							'Shows every modal again as a first-time visitor, so you can test frequency rules.',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row label={ __( 'Debug mode', 'modal-kit' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Log why each modal did or didn’t open',
							'modal-kit'
						) }
						checked={ tools.debug }
						onChange={ ( debug ) => update( { debug } ) }
					/>
					<Help>
						{ __(
							'Admins only. Messages appear in the browser console as [modal-kit].',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row label={ __( 'Setup wizard', 'modal-kit' ) }>
					<Button
						variant="secondary"
						href={ window.modalKitSettings?.wizardUrl }
						__next40pxDefaultSize
					>
						{ __( 'Run setup again', 'modal-kit' ) }
					</Button>
					<Help>
						{ __(
							'Walks through the look, behaviour and a first modal again. It only changes the settings you confirm.',
							'modal-kit'
						) }
					</Help>
				</Row>
				{ extraRows.map( ( ExtraRow, index ) => (
					<ExtraRow key={ index } notify={ notify } />
				) ) }
				<Row label={ __( 'Uninstall', 'modal-kit' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Delete all modals and settings when the plugin is deleted',
							'modal-kit'
						) }
						checked={ tools.deleteOnUninstall }
						onChange={ ( deleteOnUninstall ) =>
							update( { deleteOnUninstall } )
						}
					/>
					<Help>
						{ __(
							'Off by default, so deactivating or reinstalling never loses your work.',
							'modal-kit'
						) }
					</Help>
				</Row>
			</Section>
		</>
	);
}

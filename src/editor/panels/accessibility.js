/**
 * Accessibility panel: per-modal overrides of the site defaults
 * from Settings → Accessibility. Overridden fields are marked, and the
 * panel title gets a dot while anything is overridden.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { PluginDocumentSettingPanel } from '@wordpress/editor';

import useModalMeta from './use-modal-meta';

const NAME_LABELS = {
	heading: __( 'Modal heading', 'modal-kit' ),
	title: __( 'Modal title', 'modal-kit' ),
	custom: __( 'Custom text', 'modal-kit' ),
};

const FOCUS_LABELS = {
	heading: __( 'The heading', 'modal-kit' ),
	'first-field': __( 'First field', 'modal-kit' ),
	'first-button': __( 'First button', 'modal-kit' ),
	close: __( 'Close button', 'modal-kit' ),
};

function Hint( { overridden, children } ) {
	return overridden ? (
		<span className="modal-kit-overridden">{ children }</span>
	) : null;
}

export default function AccessibilityPanel() {
	const [ overrides, setOverrides ] = useModalMeta( 'overrides' );
	const own = overrides.accessibility ?? {};
	const site = window.modalKitEditor?.accessibility ?? {};
	const value = ( key, fallback ) => ( key in own ? own[ key ] : fallback );
	const isOverridden = Object.keys( own ).length > 0;

	const set = ( changes ) => {
		const next = { ...own };

		for ( const [ key, val ] of Object.entries( changes ) ) {
			if ( val === undefined ) {
				delete next[ key ];
			} else {
				next[ key ] = val;
			}
		}

		const { accessibility, ...rest } = overrides;
		setOverrides(
			Object.keys( next ).length ? { ...rest, accessibility: next } : rest
		);
	};

	// A value equal to the site default is not an override.
	const setOrClear = ( key, val, fallback ) =>
		set( { [ key ]: val === fallback ? undefined : val } );

	const name = value( 'name', site.name ?? 'heading' );
	const focus = value( 'focus', site.focus ?? 'heading' );
	const closeLabel = value( 'closeLabel', site.closeLabel ?? '' );
	const lockScroll = value( 'lockScroll', site.lockScroll ?? true );

	return (
		<PluginDocumentSettingPanel
			name="modal-kit-accessibility"
			title={
				<>
					{ __( 'Accessibility', 'modal-kit' ) }
					{ isOverridden && (
						<span
							className="modal-kit-override-dot"
							aria-label={ __(
								'Overrides site defaults',
								'modal-kit'
							) }
						/>
					) }
				</>
			}
			className="modal-kit-panel"
		>
			<p className="modal-kit-panel__intro">
				{ __(
					'Uses the site defaults from Settings → Accessibility. Change only what this modal needs.',
					'modal-kit'
				) }
			</p>

			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Accessible name', 'modal-kit' ) }
				value={ name }
				options={ Object.entries( NAME_LABELS ).map(
					( [ key, label ] ) => ( {
						value: key,
						label:
							key === ( site.name ?? 'heading' )
								? sprintf(
										/* translators: %s: option name. */
										__( '%s (default)', 'modal-kit' ),
										label
									)
								: label,
					} )
				) }
				onChange={ ( next ) =>
					setOrClear( 'name', next, site.name ?? 'heading' )
				}
			/>
			<Hint overridden={ 'name' in own }>
				{ sprintf(
					/* translators: %s: site default. */
					__( 'Overridden · site default is %s', 'modal-kit' ),
					NAME_LABELS[ site.name ?? 'heading' ].toLowerCase()
				) }
			</Hint>
			{ name === 'custom' && (
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Name read aloud', 'modal-kit' ) }
					value={ own.customName ?? '' }
					onChange={ ( customName ) => set( { customName } ) }
				/>
			) }

			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Focus when opened', 'modal-kit' ) }
				value={ focus }
				options={ Object.entries( FOCUS_LABELS ).map(
					( [ key, label ] ) => ( { value: key, label } )
				) }
				onChange={ ( next ) =>
					setOrClear( 'focus', next, site.focus ?? 'heading' )
				}
			/>
			<Hint overridden={ 'focus' in own }>
				{ sprintf(
					/* translators: %s: site default. */
					__( 'Overridden · site default is %s', 'modal-kit' ),
					FOCUS_LABELS[ site.focus ?? 'heading' ].toLowerCase()
				) }
			</Hint>

			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Close button label', 'modal-kit' ) }
				placeholder={ site.closeLabel || __( 'Close', 'modal-kit' ) }
				value={ closeLabel }
				onChange={ ( next ) =>
					setOrClear( 'closeLabel', next, site.closeLabel ?? '' )
				}
			/>
			<Hint overridden={ 'closeLabel' in own }>
				{ __( 'Overridden', 'modal-kit' ) }
			</Hint>

			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Lock page scroll', 'modal-kit' ) }
				checked={ !! lockScroll }
				onChange={ ( next ) =>
					setOrClear( 'lockScroll', next, site.lockScroll ?? true )
				}
			/>
			<Hint overridden={ 'lockScroll' in own }>
				{ __( 'Overridden', 'modal-kit' ) }
			</Hint>

			{ site.allowAutoClose && (
				<>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Auto-close after a delay', 'modal-kit' ) }
						help={ __(
							'If turned on, visitors get a pause button.',
							'modal-kit'
						) }
						checked={ !! own.autoClose }
						onChange={ ( autoClose ) =>
							set( {
								autoClose: autoClose || undefined,
								autoCloseDelay: autoClose
									? ( own.autoCloseDelay ?? 10 )
									: undefined,
							} )
						}
					/>
					{ own.autoClose && (
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							type="number"
							min={ 3 }
							max={ 600 }
							label={ __( 'Seconds', 'modal-kit' ) }
							value={ own.autoCloseDelay ?? 10 }
							onChange={ ( delay ) =>
								set( {
									autoCloseDelay: Math.min(
										600,
										Math.max(
											3,
											parseInt( delay, 10 ) || 3
										)
									),
								} )
							}
						/>
					) }
				</>
			) }

			<Button
				variant="secondary"
				disabled={ ! isOverridden }
				accessibleWhenDisabled
				onClick={ () => {
					const { accessibility, ...rest } = overrides;
					setOverrides( rest );
				} }
				__next40pxDefaultSize
			>
				{ __( 'Reset to defaults', 'modal-kit' ) }
			</Button>

			<p className="modal-kit-panel__help">
				{ __(
					'Always on, not settings: native dialog focus trap, Esc to close, focus returns to the trigger, page behind made inert, 44px targets, reduced-motion fade.',
					'modal-kit'
				) }
			</p>
		</PluginDocumentSettingPanel>
	);
}

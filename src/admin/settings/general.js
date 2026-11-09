/**
 * General tab: links, site-wide frequency, who never sees modals.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	CheckboxControl,
	FormTokenField,
	RadioControl,
	SelectControl,
	TextControl,
} from '@wordpress/components';

import { Help, Row, Section, useSettingsTab } from './components';

export default function General() {
	const [ general, update ] = useSettingsTab( 'general' );
	const data = window.modalKitSettings ?? {};
	const roles = data.roles ?? [];
	const roleName = ( slug ) =>
		roles.find( ( role ) => role.slug === slug )?.name ?? slug;
	const roleSlug = ( name ) =>
		roles.find( ( role ) => role.name === name || role.slug === name )
			?.slug;

	return (
		<>
			<Section title={ __( 'Links', 'modal-kit' ) }>
				<Row label={ __( 'Modal links', 'modal-kit' ) }>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( '#slug anchors', 'modal-kit' ) }
						checked={ general.linkHash }
						onChange={ ( linkHash ) => update( { linkHash } ) }
					/>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( '?modal=slug query', 'modal-kit' ) }
						checked={ general.linkQuery }
						onChange={ ( linkQuery ) => update( { linkQuery } ) }
					/>
					<Help>
						{ sprintf(
							/* translators: 1: example anchor link, 2: example query link. */
							__( 'Example: %1$s or %2$s', 'modal-kit' ),
							`/shop/#${ general.linkPrefix }autumn-sale`,
							'/shop/?modal=autumn-sale'
						) }
					</Help>
				</Row>
				<Row
					label={ __( 'Link prefix', 'modal-kit' ) }
					htmlFor="modal-kit-prefix"
				>
					<TextControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						id="modal-kit-prefix"
						className="regular-text"
						value={ general.linkPrefix }
						onChange={ ( linkPrefix ) =>
							update( {
								linkPrefix: linkPrefix
									.toLowerCase()
									.replace( /[^a-z0-9-]/g, '' ),
							} )
						}
					/>
					<Help>
						{ __(
							'Avoids clashes with heading anchors. Leave empty for #autumn-sale.',
							'modal-kit'
						) }
					</Help>
				</Row>
			</Section>

			<Section title={ __( 'This site', 'modal-kit' ) }>
				<Row label={ __( 'Modals', 'modal-kit' ) }>
					<p>
						{ sprintf(
							/* translators: 1: number of modals, 2: number active. */
							_n(
								'%1$d modal · %2$d active',
								'%1$d modals · %2$d active',
								data.site?.modals ?? 0,
								'modal-kit'
							),
							data.site?.modals ?? 0,
							data.site?.active ?? 0
						) }
					</p>
				</Row>
				<Row label={ __( 'Theme', 'modal-kit' ) }>
					<p>
						{ data.site?.blockTheme
							? sprintf(
									/* translators: %s: theme name. */
									__( '%s (block theme)', 'modal-kit' ),
									data.site?.theme
								)
							: data.site?.theme }
					</p>
				</Row>
			</Section>

			<Section title={ __( 'Frequency across all modals', 'modal-kit' ) }>
				<Row
					label={ __( 'Auto-open limit', 'modal-kit' ) }
					htmlFor="modal-kit-limit"
				>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						id="modal-kit-limit"
						value={ String( general.autoOpenLimit ) }
						options={ [
							{
								value: '1',
								label: __(
									'1 modal per page view',
									'modal-kit'
								),
							},
							{
								value: '2',
								label: __(
									'2 modals per page view',
									'modal-kit'
								),
							},
							{
								value: '3',
								label: __(
									'3 modals per page view',
									'modal-kit'
								),
							},
							{
								value: '0',
								label: __( 'No limit', 'modal-kit' ),
							},
						] }
						onChange={ ( limit ) =>
							update( { autoOpenLimit: parseInt( limit, 10 ) } )
						}
					/>
					<Help>
						{ __(
							'Click-triggered modals are never limited.',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row
					label={ __( 'Cool-down', 'modal-kit' ) }
					htmlFor="modal-kit-cooldown"
				>
					<div className="modal-kit-inline-field">
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							id="modal-kit-cooldown"
							type="number"
							min={ 0 }
							max={ 3600 }
							className="small-text"
							value={ general.cooldown }
							onChange={ ( cooldown ) =>
								update( {
									cooldown: Math.min(
										3600,
										Math.max(
											0,
											parseInt( cooldown, 10 ) || 0
										)
									),
								} )
							}
						/>
						<span>
							{ __(
								'seconds between auto-opening modals',
								'modal-kit'
							) }
						</span>
					</div>
				</Row>
				<Row label={ __( 'Remember dismissals', 'modal-kit' ) }>
					<RadioControl
						selected={ general.remember }
						options={ [
							{
								value: 'browser',
								label: __(
									'In the browser (localStorage, no cookies)',
									'modal-kit'
								),
							},
							{
								value: 'none',
								label: __(
									'Don’t remember (show every time)',
									'modal-kit'
								),
							},
						] }
						onChange={ ( remember ) => update( { remember } ) }
					/>
					<Help>
						{ __(
							'Nothing personal is stored. Changing a modal’s content resets its “seen” state.',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row label={ __( 'Don’t show to', 'modal-kit' ) }>
					<FormTokenField
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Roles', 'modal-kit' ) }
						value={ general.hideForRoles.map( roleName ) }
						suggestions={ roles.map( ( role ) => role.name ) }
						placeholder={ __( 'Add role…', 'modal-kit' ) }
						onChange={ ( names ) =>
							update( {
								hideForRoles: [
									...new Set(
										names
											.map( ( name ) =>
												roleSlug( String( name ) )
											)
											.filter( Boolean )
									),
								],
							} )
						}
					/>
					<Help>
						{ __(
							'Logged-in users with these roles still see modals in previews, and links still open them.',
							'modal-kit'
						) }
					</Help>
				</Row>
			</Section>
		</>
	);
}

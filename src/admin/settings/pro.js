/**
 * Pro tab: what Pro adds, and the switch that hides every Pro tip.
 */
import { __ } from '@wordpress/i18n';
import { ExternalLink, ToggleControl } from '@wordpress/components';

import { Help, Row, Section, useSettingsTab } from './components';

const FEATURES = [
	[ __( '9 layouts, 8 triggers, all rules', 'modal-kit' ), true ],
	[ __( 'Multi-step modals', 'modal-kit' ), false ],
	[ __( 'Form blocks + 13 integrations', 'modal-kit' ), false ],
	[ __( 'WooCommerce templates & triggers', 'modal-kit' ), false ],
	[ __( 'Pro template collections', 'modal-kit' ), false ],
	[ __( 'Games: spin, scratch, pick a gift, slots', 'modal-kit' ), false ],
	[ __( 'Results and analytics services', 'modal-kit' ), false ],
];

export default function Pro() {
	const [ pro, update ] = useSettingsTab( 'pro' );
	const data = window.modalKitSettings ?? {};

	return (
		<>
			<h2 className="title">{ __( 'What Pro adds', 'modal-kit' ) }</h2>
			<table className="widefat striped modal-kit-pro-table">
				<thead>
					<tr>
						<th scope="col">{ __( 'Feature', 'modal-kit' ) }</th>
						<th scope="col">{ __( 'Free', 'modal-kit' ) }</th>
						<th scope="col">{ __( 'Pro', 'modal-kit' ) }</th>
					</tr>
				</thead>
				<tbody>
					{ FEATURES.map( ( [ feature, free ] ) => (
						<tr key={ feature }>
							<td>{ feature }</td>
							<td>
								{ free ? (
									<span
										aria-label={ __(
											'Included',
											'modal-kit'
										) }
									>
										✓
									</span>
								) : (
									<span
										aria-label={ __(
											'Not included',
											'modal-kit'
										) }
									>
										—
									</span>
								) }
							</td>
							<td>
								<span
									aria-label={ __( 'Included', 'modal-kit' ) }
								>
									✓
								</span>
							</td>
						</tr>
					) ) }
				</tbody>
			</table>
			<p className="modal-kit-pro-links">
				<ExternalLink
					href={ data.proUrl }
					className="button button-primary"
				>
					{ __( 'Get Pro', 'modal-kit' ) }
				</ExternalLink>{ ' ' }
				{ __( 'Already bought it?', 'modal-kit' ) }{ ' ' }
				<ExternalLink href={ data.accountUrl }>
					{ __(
						'Download the add-on from your account',
						'modal-kit'
					) }
				</ExternalLink>
			</p>

			<Section title={ __( 'Pro tips in the editor', 'modal-kit' ) }>
				<Row label={ __( 'Pro tips', 'modal-kit' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Show Pro features in menus and pickers',
							'modal-kit'
						) }
						checked={ pro.showProTips }
						onChange={ ( showProTips ) =>
							update( { showProTips } )
						}
					/>
					<Help>
						{ __(
							'Turn off to hide every PRO badge, popover and Pro collection, for all users.',
							'modal-kit'
						) }
					</Help>
				</Row>
			</Section>
		</>
	);
}

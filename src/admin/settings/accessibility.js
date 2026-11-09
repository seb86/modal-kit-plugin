/**
 * Accessibility tab: site-wide defaults that each modal can
 * override in its sidebar.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	CheckboxControl,
	RadioControl,
	SelectControl,
	TextControl,
} from '@wordpress/components';

import { Help, Row, Section, useSettingsTab } from './components';

export default function Accessibility() {
	const [ a11y, update ] = useSettingsTab( 'accessibility' );
	const overriding = window.modalKitSettings?.overriding ?? 0;

	return (
		<>
			<Section title={ __( 'Defaults for every modal', 'modal-kit' ) }>
				<Row
					label={ __( 'Accessible name', 'modal-kit' ) }
					htmlFor="modal-kit-name"
				>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						id="modal-kit-name"
						value={ a11y.name }
						options={ [
							{
								value: 'heading',
								label: __(
									'The modal’s first heading',
									'modal-kit'
								),
							},
							{
								value: 'title',
								label: __( 'The modal’s title', 'modal-kit' ),
							},
						] }
						onChange={ ( name ) => update( { name } ) }
					/>
					<Help>
						{ __(
							'Used as the dialog’s label for screen readers.',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row
					label={ __( 'Focus when opened', 'modal-kit' ) }
					htmlFor="modal-kit-focus"
				>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						id="modal-kit-focus"
						value={ a11y.focus }
						options={ [
							{
								value: 'heading',
								label: __( 'The heading', 'modal-kit' ),
							},
							{
								value: 'first-button',
								label: __( 'The first button', 'modal-kit' ),
							},
							{
								value: 'close',
								label: __( 'The close button', 'modal-kit' ),
							},
						] }
						onChange={ ( focus ) => update( { focus } ) }
					/>
					<Help>
						{ __(
							'Fields and buttons can be chosen per modal.',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row
					label={ __( 'Close button label', 'modal-kit' ) }
					htmlFor="modal-kit-close-label"
				>
					<TextControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						id="modal-kit-close-label"
						className="regular-text"
						placeholder={ __( 'Close', 'modal-kit' ) }
						value={ a11y.closeLabel }
						onChange={ ( closeLabel ) => update( { closeLabel } ) }
					/>
					<Help>
						{ __(
							'Read aloud for the × button. Leave empty for “Close” in the visitor’s language.',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row label={ __( 'Page behind', 'modal-kit' ) }>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __(
							'Lock scrolling for layouts with an overlay',
							'modal-kit'
						) }
						checked={ a11y.lockScroll }
						onChange={ ( lockScroll ) => update( { lockScroll } ) }
					/>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __( 'Make it inert while open', 'modal-kit' ) }
						checked={ a11y.inert }
						onChange={ ( inert ) => update( { inert } ) }
					/>
				</Row>
				<Row label={ __( 'Per-modal overrides', 'modal-kit' ) }>
					<p>
						{ __(
							'Any modal can change these in its sidebar under Accessibility. Overridden modals are marked with a blue dot.',
							'modal-kit'
						) }{ ' ' }
						{ sprintf(
							/* translators: %d: number of modals. */
							_n(
								'%d modal currently overrides defaults.',
								'%d modals currently override defaults.',
								overriding,
								'modal-kit'
							),
							overriding
						) }
					</p>
				</Row>
			</Section>

			<Section title={ __( 'Motion & timing', 'modal-kit' ) }>
				<Row label={ __( 'Reduced motion', 'modal-kit' ) }>
					<RadioControl
						selected={ a11y.reducedMotion }
						options={ [
							{
								value: 'fade',
								label: __(
									'Use a simple fade (recommended)',
									'modal-kit'
								),
							},
							{
								value: 'none',
								label: __( 'No animation at all', 'modal-kit' ),
							},
						] }
						onChange={ ( reducedMotion ) =>
							update( { reducedMotion } )
						}
					/>
					<Help>
						{ __(
							'Applies when the visitor’s device asks for reduced motion.',
							'modal-kit'
						) }
					</Help>
				</Row>
				<Row label={ __( 'Auto-close', 'modal-kit' ) }>
					<CheckboxControl
						__nextHasNoMarginBottom
						label={ __(
							'Allow modals to close on a timer',
							'modal-kit'
						) }
						checked={ a11y.allowAutoClose }
						onChange={ ( allowAutoClose ) =>
							update( { allowAutoClose } )
						}
					/>
					<Help>
						{ __(
							'Off by default. When allowed, visitors get a pause button (WCAG 2.2.1).',
							'modal-kit'
						) }
					</Help>
				</Row>
			</Section>
		</>
	);
}

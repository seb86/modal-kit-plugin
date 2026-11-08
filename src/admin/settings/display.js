/**
 * Display tab (mockup 5b): defaults for new modals, advanced options and a
 * live preview on the real front end (so it uses the theme's own styles).
 */
import { __ } from '@wordpress/i18n';
import {
	Button,
	RadioControl,
	RangeControl,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import { useDebounce } from '@wordpress/compose';
import { useEffect, useRef, useState } from '@wordpress/element';
import { addQueryArgs } from '@wordpress/url';

import { Help, Row, Section, useSettingsTab } from './components';
import OverlayColor from '../../components/overlay-color';
import { StyleOptions, StyleSelect } from '../../components/style-options';
import { fixedStyles } from '../../styles';

const LAYOUTS = [
	[ 'centered', __( 'Centered', 'modal-kit' ) ],
	[ 'corner', __( 'Corner', 'modal-kit' ) ],
	[ 'bar', __( 'Bar', 'modal-kit' ) ],
	[ 'full', __( 'Full-screen', 'modal-kit' ) ],
	[ 'drawer', __( 'Drawer', 'modal-kit' ) ],
	[ 'split', __( 'Split', 'modal-kit' ) ],
	[ 'sheet', __( 'Sheet', 'modal-kit' ) ],
	[ 'inline', __( 'Inline', 'modal-kit' ) ],
];

const MOBILE = [
	[ 'auto', __( 'Automatic', 'modal-kit' ) ],
	[ 'sheet', __( 'Bottom sheet', 'modal-kit' ) ],
	[ 'full', __( 'Full screen', 'modal-kit' ) ],
	[ 'centered', __( 'Centered dialog', 'modal-kit' ) ],
	[ 'same', __( 'Same as desktop', 'modal-kit' ) ],
];

// The preview draws the site at these sizes, then scales it to fit.
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

/**
 * Width of an element, kept up to date.
 *
 * @param {Object} ref Element ref.
 * @return {number} Width in px (0 until measured).
 */
function useWidth( ref ) {
	const [ width, setWidth ] = useState( 0 );

	useEffect( () => {
		const node = ref.current;

		if ( ! node ) {
			return;
		}

		const observer = new window.ResizeObserver( ( [ entry ] ) =>
			setWidth( entry.contentRect.width )
		);
		observer.observe( node );

		return () => observer.disconnect();
	}, [ ref ] );

	return width;
}

const SIZES = [
	[ 's', __( 'S', 'modal-kit' ) ],
	[ 'm', __( 'M', 'modal-kit' ) ],
	[ 'l', __( 'L', 'modal-kit' ) ],
	[ 'wide', __( 'Wide', 'modal-kit' ) ],
];

function Preview( { display } ) {
	const [ device, setDevice ] = useState( 'desktop' );
	const [ src, setSrc ] = useState( '' );
	const base = window.modalKitSettings?.previewUrl ?? '';
	const frame = useRef();
	const width = useWidth( frame );

	// Desktop: a 1280px page scaled to the column. Mobile: a phone scaled to
	// the same frame height.
	const height = Math.max(
		320,
		Math.round( width * ( DESKTOP.height / DESKTOP.width ) )
	);
	const screen = device === 'mobile' ? PHONE : DESKTOP;
	const scale =
		device === 'mobile'
			? Math.min( 1, height / PHONE.height )
			: width / DESKTOP.width;

	const update = useDebounce( ( next ) => setSrc( next ), 400 );

	useEffect( () => {
		update(
			addQueryArgs( base, {
				layout: display.defaultLayout,
				mobile: display.defaultMobile,
				size: display.defaultSize,
				style: display.defaultStyle,
				accent: display.defaultAccent,
				accentColor: display.defaultAccentColor,
				fonts: display.defaultFonts,
				overlayColor: display.overlayColor,
				overlayCustomColor: display.overlayCustomColor,
				overlayOpacity: display.overlayOpacity,
				closeLabel: display.closeLabelVisible ? 1 : 0,
			} )
		);
	}, [ base, display, update ] );

	return (
		<div className="modal-kit-preview">
			<div className="modal-kit-preview__bar">
				<strong>{ __( 'Preview', 'modal-kit' ) }</strong>
				<div role="group" aria-label={ __( 'Device', 'modal-kit' ) }>
					<Button
						size="compact"
						isPressed={ device === 'desktop' }
						onClick={ () => setDevice( 'desktop' ) }
					>
						{ __( 'Desktop', 'modal-kit' ) }
					</Button>
					<Button
						size="compact"
						isPressed={ device === 'mobile' }
						onClick={ () => setDevice( 'mobile' ) }
					>
						{ __( 'Mobile', 'modal-kit' ) }
					</Button>
				</div>
			</div>
			<div
				ref={ frame }
				className={ `modal-kit-preview__frame is-${ device }` }
				style={ { height } }
			>
				{ src && width > 0 && (
					<iframe
						title={ __(
							'Preview of a modal with these defaults',
							'modal-kit'
						) }
						src={ src }
						tabIndex={ -1 }
						style={ {
							width: screen.width,
							// Desktop: as tall as the frame once scaled, so a
							// narrow column shows more page instead of a gap.
							height:
								device === 'mobile'
									? screen.height
									: Math.ceil( height / scale ),
							transform: `scale(${ scale })`,
						} }
					/>
				) }
			</div>
		</div>
	);
}

export default function Display() {
	const [ display, update ] = useSettingsTab( 'display' );
	const palette = window.modalKitSettings?.palette ?? [];
	const origins = palette.length
		? [ { name: __( 'Theme', 'modal-kit' ), colors: palette } ]
		: [];

	return (
		<div className="modal-kit-display">
			<div className="modal-kit-display__form">
				<Section title={ __( 'Defaults for new modals', 'modal-kit' ) }>
					<Row
						label={ __( 'Layout', 'modal-kit' ) }
						htmlFor="modal-kit-layout"
					>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							id="modal-kit-layout"
							value={ display.defaultLayout }
							options={ LAYOUTS.map( ( [ value, label ] ) => ( {
								value,
								label,
							} ) ) }
							onChange={ ( defaultLayout ) =>
								update( { defaultLayout } )
							}
						/>
					</Row>
					<Row
						label={ __( 'On mobile', 'modal-kit' ) }
						htmlFor="modal-kit-mobile"
					>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							id="modal-kit-mobile"
							value={ display.defaultMobile }
							options={ MOBILE.map( ( [ value, label ] ) => ( {
								value,
								label,
							} ) ) }
							onChange={ ( defaultMobile ) =>
								update( { defaultMobile } )
							}
						/>
					</Row>
					<Row label={ __( 'Size', 'modal-kit' ) }>
						<div
							className="modal-kit-segmented"
							role="radiogroup"
							aria-label={ __( 'Size', 'modal-kit' ) }
						>
							{ SIZES.map( ( [ value, label ] ) => (
								<Button
									key={ value }
									role="radio"
									aria-checked={
										display.defaultSize === value
									}
									isPressed={ display.defaultSize === value }
									onClick={ () =>
										update( { defaultSize: value } )
									}
									__next40pxDefaultSize
								>
									{ label }
								</Button>
							) ) }
						</div>
						<Help>
							{ __(
								'S / M / L map to your theme’s content and wide sizes.',
								'modal-kit'
							) }
						</Help>
					</Row>
					<Row
						label={ __( 'Style', 'modal-kit' ) }
						htmlFor="modal-kit-style"
					>
						<StyleSelect
							id="modal-kit-style"
							value={ display.defaultStyle }
							onChange={ ( defaultStyle ) =>
								update( { defaultStyle } )
							}
						/>
					</Row>
					<StyleOptions
						styleSlug={ display.defaultStyle }
						value={ {
							accent: display.defaultAccent,
							accentColor: display.defaultAccentColor,
							fonts: display.defaultFonts,
						} }
						colors={ origins }
						themePrimary={
							window.modalKitSettings?.themePrimary ?? ''
						}
						onChange={ ( changes ) =>
							update( {
								...( 'accent' in changes && {
									defaultAccent: changes.accent,
								} ),
								...( 'accentColor' in changes && {
									defaultAccentColor: changes.accentColor,
								} ),
								...( 'fonts' in changes && {
									defaultFonts: changes.fonts,
								} ),
							} )
						}
						renderRow={ ( label, control ) => (
							<Row key={ label } label={ label }>
								{ control }
							</Row>
						) }
					/>
					<Row label={ __( 'Overlay', 'modal-kit' ) }>
						<div className="modal-kit-overlay-field">
							<OverlayColor
								origins={ origins }
								color={ display.overlayColor }
								customColor={ display.overlayCustomColor }
								placement="bottom-start"
								onChange={ ( { color, customColor } ) =>
									update( {
										overlayColor: color,
										overlayCustomColor: customColor,
									} )
								}
							/>
							<RangeControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __( 'Opacity', 'modal-kit' ) }
								value={ display.overlayOpacity }
								min={ 0 }
								max={ 100 }
								onChange={ ( overlayOpacity ) =>
									update( {
										overlayOpacity: overlayOpacity ?? 45,
									} )
								}
							/>
						</div>
						<Help>
							{ fixedStyles()[ display.defaultStyle ]
								? __(
										'Your theme’s colors, or any color with the picker. Leave empty to use the style’s overlay color.',
										'modal-kit'
									)
								: __(
										'Your theme’s colors, or any color with the picker. Leave empty to use the text color.',
										'modal-kit'
									) }
						</Help>
					</Row>
					<Row label={ __( 'Close button', 'modal-kit' ) }>
						<RadioControl
							selected={
								display.closeLabelVisible ? 'label' : 'icon'
							}
							options={ [
								{
									value: 'icon',
									label: __(
										'Icon (×) with screen-reader label',
										'modal-kit'
									),
								},
								{
									value: 'label',
									label: __(
										'Icon + visible “Close” label',
										'modal-kit'
									),
								},
							] }
							onChange={ ( choice ) =>
								update( {
									closeLabelVisible: choice === 'label',
								} )
							}
						/>
					</Row>
					<Row
						label={ __( 'Animation', 'modal-kit' ) }
						htmlFor="modal-kit-animation"
					>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							id="modal-kit-animation"
							value={ display.animation }
							options={ [
								{
									value: 'fade-rise',
									label: __( 'Fade + rise', 'modal-kit' ),
								},
								{
									value: 'fade',
									label: __( 'Fade', 'modal-kit' ),
								},
								{
									value: 'none',
									label: __( 'None', 'modal-kit' ),
								},
							] }
							onChange={ ( animation ) =>
								update( { animation } )
							}
						/>
						<Help>
							{ __(
								'Always replaced by a simple fade when the visitor prefers reduced motion.',
								'modal-kit'
							) }
						</Help>
					</Row>
				</Section>

				<Section title={ __( 'Advanced', 'modal-kit' ) }>
					<Row
						label={ __( 'Mobile breakpoint', 'modal-kit' ) }
						htmlFor="modal-kit-breakpoint"
					>
						<div className="modal-kit-inline-field">
							<TextControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								id="modal-kit-breakpoint"
								type="number"
								min={ 320 }
								max={ 1200 }
								className="small-text"
								value={ display.breakpoint }
								onChange={ ( breakpoint ) =>
									update( {
										breakpoint: Math.min(
											1200,
											Math.max(
												320,
												parseInt( breakpoint, 10 ) ||
													600
											)
										),
									} )
								}
							/>
							<span>px</span>
						</div>
						<Help>
							{ __(
								'Below this width modals switch to their mobile layout.',
								'modal-kit'
							) }
						</Help>
					</Row>
					<Row
						label={ __( 'Stacking (z-index)', 'modal-kit' ) }
						htmlFor="modal-kit-z"
					>
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							id="modal-kit-z"
							type="number"
							min={ 1 }
							className="regular-text"
							value={ display.zIndex }
							onChange={ ( zIndex ) =>
								update( {
									zIndex: Math.max(
										1,
										parseInt( zIndex, 10 ) || 100000
									),
								} )
							}
						/>
						<Help>
							{ __(
								'Raise this if your theme’s sticky header sits on top of modals.',
								'modal-kit'
							) }
						</Help>
					</Row>
				</Section>
			</div>
			<Preview display={ display } />
		</div>
	);
}

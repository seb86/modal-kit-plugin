/**
 * Video panel: appears when the modal contains a Video or Embed
 * block. Settings live in the modal's overrides (video).
 */
import { __ } from '@wordpress/i18n';
import { store as blockEditorStore } from '@wordpress/block-editor';
import {
	BaseControl,
	Button,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { PluginDocumentSettingPanel } from '@wordpress/editor';

import useModalMeta from './use-modal-meta';

const DEFAULTS = {
	aspectRatio: '16:9',
	autoplay: false,
	resume: false,
	closeOnEnd: false,
	load: 'open',
	clickToLoad: true,
	nocookie: true,
	clickToLoadMessage: '',
};

const RATIOS = [ '16:9', '9:16', '4:3', '1:1' ];

export default function VideoPanel() {
	const hasVideo = useSelect( ( select ) => {
		const editor = select( blockEditorStore );

		return editor
			.getClientIdsWithDescendants()
			.some( ( clientId ) =>
				[ 'core/video', 'core/embed' ].includes(
					editor.getBlockName( clientId )
				)
			);
	}, [] );
	const [ overrides, setOverrides ] = useModalMeta( 'overrides' );

	if ( ! hasVideo ) {
		return null;
	}

	const video = { ...DEFAULTS, ...( overrides.video ?? {} ) };
	const set = ( changes ) =>
		setOverrides( { ...overrides, video: { ...video, ...changes } } );

	return (
		<PluginDocumentSettingPanel
			name="modal-kit-video"
			title={ __( 'Video', 'modal-kit' ) }
			className="modal-kit-panel"
		>
			<BaseControl
				__nextHasNoMarginBottom
				id="modal-kit-video-ratio"
				label={ __( 'Aspect ratio', 'modal-kit' ) }
			>
				<div
					id="modal-kit-video-ratio"
					className="modal-kit-devices"
					role="radiogroup"
					aria-label={ __( 'Aspect ratio', 'modal-kit' ) }
				>
					{ RATIOS.map( ( ratio ) => (
						<Button
							key={ ratio }
							role="radio"
							aria-checked={ video.aspectRatio === ratio }
							isPressed={ video.aspectRatio === ratio }
							onClick={ () => set( { aspectRatio: ratio } ) }
							__next40pxDefaultSize
						>
							{ ratio }
						</Button>
					) ) }
				</div>
			</BaseControl>

			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Autoplay when opened (muted)', 'modal-kit' ) }
				checked={ video.autoplay }
				onChange={ ( autoplay ) => set( { autoplay } ) }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Resume where they left off', 'modal-kit' ) }
				checked={ video.resume }
				onChange={ ( resume ) => set( { resume } ) }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Close when the video ends', 'modal-kit' ) }
				checked={ video.closeOnEnd }
				onChange={ ( closeOnEnd ) => set( { closeOnEnd } ) }
			/>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Load video', 'modal-kit' ) }
				value={ video.load }
				options={ [
					{
						value: 'open',
						label: __( 'When the modal opens', 'modal-kit' ),
					},
					{
						value: 'page',
						label: __( 'With the page', 'modal-kit' ),
					},
				] }
				onChange={ ( load ) => set( { load } ) }
				help={ __(
					'Always pauses when the modal closes.',
					'modal-kit'
				) }
			/>

			<fieldset>
				<legend>{ __( 'Privacy', 'modal-kit' ) }</legend>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __(
						'Click-to-load screen for embeds',
						'modal-kit'
					) }
					checked={ video.clickToLoad }
					onChange={ ( clickToLoad ) => set( { clickToLoad } ) }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Use youtube-nocookie.com', 'modal-kit' ) }
					checked={ video.nocookie }
					onChange={ ( nocookie ) => set( { nocookie } ) }
				/>
				{ video.clickToLoad && (
					<TextControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Click-to-load message', 'modal-kit' ) }
						placeholder={ __(
							'Loads from YouTube, which may set cookies.',
							'modal-kit'
						) }
						value={ video.clickToLoadMessage }
						onChange={ ( clickToLoadMessage ) =>
							set( { clickToLoadMessage } )
						}
					/>
				) }
			</fieldset>

			<p className="modal-kit-panel__help">
				{ __(
					'Captions come from the Video block’s own text tracks. Visitors who prefer reduced motion press play themselves.',
					'modal-kit'
				) }
			</p>
		</PluginDocumentSettingPanel>
	);
}

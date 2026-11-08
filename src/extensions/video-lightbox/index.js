/**
 * "Play in video lightbox" (mockup 6b) for Button, Image and Cover, in every
 * block editor. A Button or Image keeps its link (a real URL, so it still
 * works without JavaScript); a Cover gets a video address of its own.
 * Stored in block attributes only, so the saved markup doesn't change.
 */
import { __, sprintf } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls } from '@wordpress/block-editor';
import {
	ExternalLink,
	PanelBody,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { addQueryArgs } from '@wordpress/url';

const BLOCKS = [ 'core/button', 'core/image', 'core/cover' ];

/**
 * The video service of a URL, for the "detected" hint.
 *
 * @param {string} url URL.
 * @return {string|null} Service name, or null if it can't play.
 */
export function videoService( url ) {
	if ( ! url ) {
		return null;
	}

	if (
		/(^|\/\/)(www\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i.test( url )
	) {
		return 'YouTube';
	}

	if ( /(^|\/\/)(www\.|player\.)?vimeo\.com\//i.test( url ) ) {
		return 'Vimeo';
	}

	if ( /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test( url ) ) {
		return __( 'Video file', 'modal-kit' );
	}

	return null;
}

function urlOf( name, attributes ) {
	if ( name === 'core/cover' ) {
		return attributes.modalKitVideoUrl ?? '';
	}

	return name === 'core/image'
		? ( attributes.href ?? '' )
		: ( attributes.url ?? '' );
}

function VideoLightboxPanel( { name, attributes, setAttributes } ) {
	const url = urlOf( name, attributes );
	const service = videoService( url );
	const isCover = name === 'core/cover';

	if ( ! isCover && ! service ) {
		return null;
	}

	return (
		<InspectorControls>
			<PanelBody title={ __( 'Video lightbox', 'modal-kit' ) }>
				{ isCover && (
					<TextControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Video address', 'modal-kit' ) }
						help={ __(
							'A YouTube or Vimeo link, or a video file.',
							'modal-kit'
						) }
						type="url"
						value={ attributes.modalKitVideoUrl ?? '' }
						onChange={ ( modalKitVideoUrl ) =>
							setAttributes( { modalKitVideoUrl } )
						}
					/>
				) }
				{ service && (
					<>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __(
								'Play in video lightbox',
								'modal-kit'
							) }
							help={ sprintf(
								/* translators: %s: video service, e.g. YouTube. */
								__( '%s detected.', 'modal-kit' ),
								service
							) }
							checked={ !! attributes.modalKitVideoLightbox }
							onChange={ ( modalKitVideoLightbox ) =>
								setAttributes( { modalKitVideoLightbox } )
							}
						/>
						{ attributes.modalKitVideoLightbox && (
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __(
									'Click-to-load screen',
									'modal-kit'
								) }
								help={ __(
									'Nothing loads from the video service until the visitor presses play.',
									'modal-kit'
								) }
								checked={
									attributes.modalKitVideoClickToLoad !==
									false
								}
								onChange={ ( modalKitVideoClickToLoad ) =>
									setAttributes( {
										modalKitVideoClickToLoad,
									} )
								}
							/>
						) }
					</>
				) }
				<p>
					{ __( 'Need a caption or button under it?', 'modal-kit' ) }{ ' ' }
					<ExternalLink
						href={ addQueryArgs( 'post-new.php', {
							post_type: 'mk_modal',
							mk_pattern: 'modal-kit/video-tour',
						} ) }
					>
						{ __( 'Turn it into a modal', 'modal-kit' ) }
					</ExternalLink>
				</p>
			</PanelBody>
		</InspectorControls>
	);
}

addFilter(
	'blocks.registerBlockType',
	'modal-kit/video-lightbox/attributes',
	( settings, name ) => {
		if ( ! BLOCKS.includes( name ) ) {
			return settings;
		}

		return {
			...settings,
			attributes: {
				...settings.attributes,
				modalKitVideoLightbox: { type: 'boolean' },
				modalKitVideoClickToLoad: { type: 'boolean' },
				...( name === 'core/cover'
					? { modalKitVideoUrl: { type: 'string' } }
					: {} ),
			},
		};
	}
);

addFilter(
	'editor.BlockEdit',
	'modal-kit/video-lightbox/control',
	createHigherOrderComponent(
		( BlockEdit ) =>
			function VideoLightboxEdit( props ) {
				if ( ! BLOCKS.includes( props.name ) ) {
					return <BlockEdit { ...props } />;
				}

				return (
					<>
						<BlockEdit { ...props } />
						<VideoLightboxPanel { ...props } />
					</>
				);
			},
		'withModalKitVideoLightbox'
	)
);

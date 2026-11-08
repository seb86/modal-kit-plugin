<?php
/**
 * "Play in video lightbox" links (mockup 6b).
 *
 * @package ModalKit
 */

namespace ModalKit;

use WP_HTML_Tag_Processor;
use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * A Button, Image or Cover can play a video in a lightbox, with no modal post
 * needed. The link stays a real URL, so with JavaScript off it opens the
 * video's own page. One shared lightbox is printed on pages that need it.
 */
final class VideoLinks {

	/**
	 * Slug of the shared lightbox.
	 */
	const SLUG = 'video-lightbox';

	/**
	 * Whether the current page has a video link.
	 *
	 * @var bool
	 */
	private static $needed = false;

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		foreach ( array( 'core/button', 'core/image', 'core/cover' ) as $name ) {
			add_filter( 'render_block_' . $name, array( $this, 'render' ), 10, 2 );
		}
	}

	/**
	 * Whether the shared lightbox must be printed.
	 *
	 * @return bool
	 */
	public static function needed() {
		return self::$needed;
	}

	/**
	 * Whether a URL is something the lightbox can play.
	 *
	 * @param string $url URL.
	 * @return bool
	 */
	public static function is_playable( $url ) {
		return '' !== Video::provider( $url ) || (bool) preg_match( '/\.(mp4|webm|ogv|mov)(\?|#|$)/i', $url );
	}

	/**
	 * Adds the lightbox directives to a video link.
	 *
	 * @param string               $content Rendered block.
	 * @param array<string, mixed> $block   Parsed block.
	 * @return string
	 */
	public function render( $content, $block ) {
		if ( empty( $block['attrs']['modalKitVideoLightbox'] ) ) {
			return $content;
		}

		$click_to_load = ! isset( $block['attrs']['modalKitVideoClickToLoad'] ) || (bool) $block['attrs']['modalKitVideoClickToLoad'];
		$processor     = new WP_HTML_Tag_Processor( $content );

		if ( 'core/cover' === $block['blockName'] ) {
			$url = isset( $block['attrs']['modalKitVideoUrl'] ) ? (string) $block['attrs']['modalKitVideoUrl'] : '';

			if ( ! self::is_playable( $url ) || ! $processor->next_tag() ) {
				return $content;
			}

			// The Cover itself becomes the play button.
			$processor->set_attribute( 'role', 'button' );
			$processor->set_attribute( 'tabindex', '0' );
			$processor->set_attribute( 'aria-label', __( 'Play video', 'modal-kit' ) );
			$processor->set_attribute( 'data-wp-on--keydown', 'modal-kit::actions.videoKey' );
		} else {
			if ( ! $processor->next_tag( array( 'tag_name' => 'a' ) ) ) {
				return $content;
			}

			$url = (string) $processor->get_attribute( 'href' );

			if ( ! self::is_playable( $url ) ) {
				return $content;
			}
		}

		$processor->set_attribute( 'data-wp-interactive', 'modal-kit' );
		$processor->set_attribute( 'data-wp-on--click', 'modal-kit::actions.playVideo' );
		$processor->set_attribute( 'data-modal-kit-video', esc_url_raw( $url ) );
		$processor->set_attribute( 'data-modal-kit-click-to-load', $click_to_load ? '1' : '0' );

		self::$needed = true;

		return $processor->get_updated_html();
	}

	/**
	 * The shared lightbox: a video-layout modal with an empty player slot.
	 *
	 * @return WP_Post
	 */
	public static function post() {
		$attributes = array(
			'modalLayout'  => 'video',
			'overlay'      => array(
				'show'    => true,
				'color'   => '',
				'opacity' => 92,
				'blur'    => false,
			),
			'closeOptions' => array(
				'button'       => true,
				'esc'          => true,
				'outside'      => true,
				'visibleLabel' => true,
			),
		);

		$slot = '<!-- wp:html --><div class="modal-kit-video-slot wp-block-embed is-type-video"><div class="wp-block-embed__wrapper"></div></div><!-- /wp:html -->';

		return new WP_Post(
			(object) array(
				'ID'           => 0,
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => self::SLUG,
				'post_title'   => __( 'Video', 'modal-kit' ),
				'post_content' => '<!-- wp:modal-kit/modal ' . wp_json_encode( $attributes ) . ' -->' . $slot . '<!-- /wp:modal-kit/modal -->',
				'filter'       => 'raw',
			)
		);
	}
}

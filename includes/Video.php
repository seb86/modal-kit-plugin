<?php
/**
 * Video in modals.
 *
 * @package ModalKit
 */

namespace ModalKit;

use WP_HTML_Tag_Processor;

defined( 'ABSPATH' ) || exit;

/**
 * Prepares the Video and Embed blocks inside a modal: YouTube uses
 * youtube-nocookie.com by default, player APIs are enabled so the runtime
 * can pause on close, and third-party players load only when the modal
 * opens, optionally behind a click-to-load screen.
 */
final class Video {

	/**
	 * Defaults of the Video panel.
	 *
	 * @return array{aspectRatio: string, autoplay: bool, resume: bool, closeOnEnd: bool, load: string, clickToLoad: bool, nocookie: bool, clickToLoadMessage: string}
	 */
	public static function defaults() {
		return array(
			'aspectRatio'        => '16:9',
			'autoplay'           => false,
			'resume'             => false,
			'closeOnEnd'         => false,
			'load'               => 'open',
			'clickToLoad'        => true,
			'nocookie'           => true,
			'clickToLoadMessage' => '',
		);
	}

	/**
	 * A modal's video settings.
	 *
	 * @param int $post_id Modal ID.
	 * @return array<string, mixed>
	 */
	public static function settings( $post_id ) {
		$overrides = Meta::get( $post_id, 'overrides' );
		$own       = isset( $overrides['video'] ) && is_array( $overrides['video'] ) ? $overrides['video'] : array();

		return array_merge( self::defaults(), array_intersect_key( $own, self::defaults() ) );
	}

	/**
	 * Whether rendered markup contains a video or a video embed.
	 *
	 * @param string $html Markup.
	 * @return bool
	 */
	public static function has_video( $html ) {
		return false !== strpos( $html, 'wp-block-video' ) || false !== strpos( $html, 'wp-block-embed' );
	}

	/**
	 * The ratio as a CSS value, e.g. "16 / 9".
	 *
	 * @param string $ratio 16:9 | 9:16 | 4:3 | 1:1.
	 * @return string
	 */
	public static function css_ratio( $ratio ) {
		return in_array( $ratio, array( '16:9', '9:16', '4:3', '1:1' ), true ) ? str_replace( ':', ' / ', $ratio ) : '16 / 9';
	}

	/**
	 * The video service an embed URL belongs to.
	 *
	 * @param string $url URL.
	 * @return string youtube | vimeo | ''.
	 */
	public static function provider( $url ) {
		$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );

		// A host in the URL doesn't make it a web address: javascript://youtu.be/.
		if ( ! in_array( $scheme, array( '', 'http', 'https' ), true ) ) {
			return '';
		}

		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );

		if ( preg_match( '/(^|\.)(youtube(-nocookie)?\.com|youtu\.be)$/', $host ) ) {
			return 'youtube';
		}

		if ( preg_match( '/(^|\.)vimeo\.com$/', $host ) ) {
			return 'vimeo';
		}

		return '';
	}

	/**
	 * Rewrites an embed URL: privacy-enhanced YouTube, player APIs on.
	 *
	 * @param string $url      Player URL.
	 * @param bool   $nocookie Use youtube-nocookie.com.
	 * @return string
	 */
	public static function player_url( $url, $nocookie = true ) {
		$provider = self::provider( $url );

		if ( 'youtube' === $provider ) {
			if ( $nocookie ) {
				$url = preg_replace( '#//(www\.)?youtube\.com/#i', '//www.youtube-nocookie.com/', $url );
			}

			return add_query_arg(
				array(
					'enablejsapi' => 1,
					'playsinline' => 1,
					'rel'         => 0,
				),
				$url
			);
		}

		if ( 'vimeo' === $provider ) {
			return add_query_arg( array( 'dnt' => 1 ), $url );
		}

		return $url;
	}

	/**
	 * Prepares the video markup of a modal panel.
	 *
	 * @param string               $html     Panel markup.
	 * @param array<string, mixed> $settings Video settings.
	 * @return string
	 */
	public static function prepare( $html, $settings ) {
		if ( ! self::has_video( $html ) ) {
			return $html;
		}

		$defer     = 'open' === $settings['load'] || $settings['clickToLoad'];
		$processor = new WP_HTML_Tag_Processor( $html );
		$consent   = array();

		while ( $processor->next_tag() ) {
			$tag = $processor->get_tag();

			if ( 'IFRAME' === $tag ) {
				$src      = (string) $processor->get_attribute( 'src' );
				$provider = self::provider( $src );

				if ( '' === $provider ) {
					continue;
				}

				$src = self::player_url( $src, (bool) $settings['nocookie'] );

				$processor->set_attribute( 'data-modal-kit-provider', $provider );
				$processor->set_attribute( 'allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media' );

				if ( $defer ) {
					// Loaded by the runtime when the modal opens (or on click).
					$processor->set_attribute( 'data-modal-kit-src', $src );
					$processor->remove_attribute( 'src' );
				} else {
					$processor->set_attribute( 'src', $src );
				}

				if ( $settings['clickToLoad'] ) {
					$consent[] = $provider;
				}
			}

			if ( 'VIDEO' === $tag ) {
				$processor->set_attribute( 'playsinline', true );

				if ( 'open' === $settings['load'] ) {
					$processor->set_attribute( 'preload', 'none' );
				}
			}
		}

		$html = $processor->get_updated_html();

		// One click-to-load screen after each deferred iframe, in order.
		foreach ( $consent as $provider ) {
			$html = (string) preg_replace( '#</iframe>(?!<div class="modal-kit-consent")#i', '</iframe>' . self::consent_screen( $provider, (string) $settings['clickToLoadMessage'] ), $html, 1 );
		}

		return $html;
	}

	/**
	 * The click-to-load screen.
	 *
	 * @param string $provider youtube | vimeo.
	 * @param string $message  Custom message, or '' for the default.
	 * @return string
	 */
	public static function consent_screen( $provider, $message = '' ) {
		$names = array(
			'youtube' => 'YouTube',
			'vimeo'   => 'Vimeo',
		);
		$name  = isset( $names[ $provider ] ) ? $names[ $provider ] : __( 'the video service', 'modal-kit' );

		if ( '' === trim( $message ) ) {
			/* translators: %s: video service, e.g. YouTube. */
			$message = sprintf( __( 'Loads from %s, which may set cookies.', 'modal-kit' ), $name );
		}

		return sprintf(
			'<div class="modal-kit-consent"><button type="button" class="modal-kit-consent__play" data-wp-on--click="modal-kit::actions.loadVideo"><span aria-hidden="true">▶</span> %1$s</button><p class="modal-kit-consent__note">%2$s</p></div>',
			esc_html__( 'Play video', 'modal-kit' ),
			esc_html( $message )
		);
	}
}

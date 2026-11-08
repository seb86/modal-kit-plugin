<?php
/**
 * Limits on what people without unfiltered_html can put in a modal.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Two gaps kses leaves for this plugin:
 *
 * - It only checks URLs on the attributes in wp_kses_uri_attributes(), so a
 *   `javascript:` address survives in the data attributes that hold a video's
 *   address. The runtime refuses those as well (src/runtime/safe-url.js), for
 *   content saved before this filter or by someone with unfiltered_html.
 * - It keeps `data-wp-*` attributes, and Render::dialog() runs the
 *   Interactivity API's server pass over a modal's whole panel. Modals don't
 *   save directives of their own (they're added when a modal renders), so they
 *   are taken out of a modal saved by anyone who can't write unfiltered HTML.
 */
final class Hardening {

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_filter( 'wp_kses_uri_attributes', array( __CLASS__, 'uri_attributes' ) );
		add_filter( 'wp_insert_post_data', array( __CLASS__, 'clean_modal' ), 20 );
	}

	/**
	 * Attributes kses treats as URLs.
	 *
	 * @param string[] $attributes Attribute names.
	 * @return string[]
	 */
	public static function uri_attributes( $attributes ) {
		$attributes[] = 'data-modal-kit-video';
		$attributes[] = 'data-modal-kit-src';

		return $attributes;
	}

	/**
	 * Takes directives out of a modal saved without unfiltered_html.
	 *
	 * @param array<string, mixed> $data Slashed post data.
	 * @return array<string, mixed>
	 */
	public static function clean_modal( $data ) {
		if ( PostType::NAME !== ( $data['post_type'] ?? '' ) || current_user_can( 'unfiltered_html' ) ) {
			return $data;
		}

		$data['post_content'] = wp_slash( self::strip_directives( wp_unslash( (string) $data['post_content'] ) ) );

		return $data;
	}

	/**
	 * Removes every `data-wp-*` attribute from some HTML.
	 *
	 * @param string $html HTML.
	 * @return string
	 */
	public static function strip_directives( $html ) {
		if ( false === stripos( $html, 'data-wp-' ) ) {
			return $html;
		}

		$processor = new \WP_HTML_Tag_Processor( $html );

		while ( $processor->next_tag() ) {
			foreach ( (array) $processor->get_attribute_names_with_prefix( 'data-wp-' ) as $name ) {
				$processor->remove_attribute( $name );
			}
		}

		return $processor->get_updated_html();
	}
}

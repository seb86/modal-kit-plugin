<?php
/**
 * Accessibility settings for a modal.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Merges the site defaults (Settings → Accessibility, mockup 5h) with a
 * modal's own overrides (sidebar panel, mockup 5c).
 */
final class Accessibility {

	/**
	 * Effective settings for a modal.
	 *
	 * @param int $post_id Modal ID (0 for the site defaults).
	 * @return array{name: string, customName: string, focus: string, closeLabel: string, lockScroll: bool, inert: bool, reducedMotion: string, autoClose: int}
	 */
	public static function for_modal( $post_id = 0 ) {
		$site      = Settings::get( 'accessibility' );
		$overrides = $post_id ? Meta::get( $post_id, 'overrides' ) : array();
		$own       = isset( $overrides['accessibility'] ) && is_array( $overrides['accessibility'] ) ? $overrides['accessibility'] : array();

		$pick = static function ( $key, $fallback ) use ( $own ) {
			return array_key_exists( $key, $own ) ? $own[ $key ] : $fallback;
		};

		$name        = (string) $pick( 'name', $site['name'] );
		$close_label = trim( (string) $pick( 'closeLabel', $site['closeLabel'] ) );
		$auto_close  = $site['allowAutoClose'] && $pick( 'autoClose', false ) ? max( 3, (int) $pick( 'autoCloseDelay', 10 ) ) : 0;

		return array(
			'name'          => in_array( $name, array( 'heading', 'title', 'custom' ), true ) ? $name : 'heading',
			'customName'    => (string) $pick( 'customName', '' ),
			'focus'         => (string) $pick( 'focus', $site['focus'] ),
			'closeLabel'    => '' !== $close_label ? $close_label : __( 'Close', 'modal-kit' ),
			'lockScroll'    => (bool) $pick( 'lockScroll', $site['lockScroll'] ),
			'inert'         => (bool) $site['inert'],
			'reducedMotion' => 'none' === $site['reducedMotion'] ? 'none' : 'fade',
			'autoClose'     => $auto_close,
		);
	}

	/**
	 * Number of modals that override any site default (shown on 5h).
	 *
	 * @return int
	 */
	public static function overriding_count() {
		$ids   = get_posts(
			array(
				'post_type'      => PostType::NAME,
				'post_status'    => array( 'publish', 'draft', 'future', 'private' ),
				'posts_per_page' => 500, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- Admin only; sites have a handful of modals.
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		$count = 0;

		foreach ( $ids as $id ) {
			$overrides = Meta::get( (int) $id, 'overrides' );

			if ( ! empty( $overrides['accessibility'] ) ) {
				++$count;
			}
		}

		return $count;
	}
}

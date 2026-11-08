<?php
/**
 * Server-side rules: page targeting and the visitor flag.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Decides, while a page renders, whether a modal targets it. Time, device and
 * visitor rules run in the browser (runtime/rules.js); the server only adds a
 * flag when the logged-in visitor should not get automatic modals.
 */
final class Rules {

	/**
	 * Whether a modal's page targeting matches the current request.
	 *
	 * Three modes (1f): "all" (entire site), "include" (only these pages)
	 * and "exclude" (everywhere except these pages). Only the list for the
	 * mode is used, except that "include" also honours exceptions when it
	 * lists a section ("/shop/*"): the only case where they change anything.
	 *
	 * Each entry is a post picked in the editor ("post:123", matched by ID so
	 * it survives slug changes) or a path pattern ("/", "/shop/*").
	 *
	 * @param array<string, mixed> $rules     Modal rules (Meta::get( id, 'rules' )).
	 * @param string|null          $path      Request path; defaults to the current one.
	 * @param int|null             $object_id Queried post ID; defaults to the current one.
	 * @return bool
	 */
	public static function targets_request( $rules, $path = null, $object_id = null ) {
		$show_on   = isset( $rules['showOn'] ) && is_array( $rules['showOn'] ) ? $rules['showOn'] : array();
		$path      = null === $path ? self::current_path() : self::normalize_path( $path );
		$object_id = null === $object_id ? self::current_object_id() : (int) $object_id;

		$mode = isset( $show_on['mode'] ) ? (string) $show_on['mode'] : 'all';

		if ( 'exclude' === $mode || self::exceptions_apply( $show_on ) ) {
			foreach ( isset( $show_on['exclude'] ) ? (array) $show_on['exclude'] : array() as $pattern ) {
				if ( self::entry_matches( (string) $pattern, $path, $object_id ) ) {
					return false;
				}
			}
		}

		if ( 'include' !== $mode ) {
			return true;
		}

		foreach ( isset( $show_on['include'] ) ? (array) $show_on['include'] : array() as $pattern ) {
			if ( self::entry_matches( (string) $pattern, $path, $object_id ) ) {
				return true;
			}
		}

		$post_types = isset( $show_on['postTypes'] ) ? array_filter( (array) $show_on['postTypes'] ) : array();

		return $post_types && is_singular( $post_types );
	}

	/**
	 * Whether "Only these pages" has exceptions that count: it lists a
	 * section (a path ending in "*").
	 *
	 * @param array<string, mixed> $show_on The showOn rule.
	 * @return bool
	 */
	public static function exceptions_apply( $show_on ) {
		if ( ! isset( $show_on['mode'] ) || 'include' !== $show_on['mode'] ) {
			return false;
		}

		foreach ( isset( $show_on['include'] ) ? (array) $show_on['include'] : array() as $entry ) {
			if ( '*' === substr( trim( (string) $entry ), -1 ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Whether one include or exclude entry matches the request.
	 *
	 * @param string $entry     "post:123" or a path pattern.
	 * @param string $path      Normalised request path.
	 * @param int    $object_id Queried post ID (0 when none).
	 * @return bool
	 */
	public static function entry_matches( $entry, $path, $object_id ) {
		if ( preg_match( '/^post:(\d+)$/', trim( $entry ), $match ) ) {
			return $object_id > 0 && (int) $match[1] === $object_id;
		}

		return self::path_matches( $entry, $path );
	}

	/**
	 * The post the request shows: a singular post or page, the static front
	 * page, or the posts page. 0 for archives and other views.
	 *
	 * @return int
	 */
	public static function current_object_id() {
		return is_singular() || is_front_page() || is_home() ? (int) get_queried_object_id() : 0;
	}

	/**
	 * Whether a path pattern matches a path. Patterns are site paths such as
	 * "/", "/shop/" or "/shop/*"; a full URL is reduced to its path.
	 *
	 * @param string $pattern Pattern.
	 * @param string $path    Normalised path.
	 * @return bool
	 */
	public static function path_matches( $pattern, $path ) {
		$pattern = trim( $pattern );

		if ( '' === $pattern ) {
			return false;
		}

		$wildcard = '*' === substr( $pattern, -1 );
		$pattern  = self::normalize_path( $wildcard ? rtrim( $pattern, '*' ) : $pattern );
		$regex    = str_replace( '\*', '[^/]*', preg_quote( $pattern, '#' ) );

		return (bool) preg_match( '#^' . $regex . ( $wildcard ? '.*' : '' ) . '$#i', $path );
	}

	/**
	 * Current request path relative to the site home, e.g. "/shop/notebooks/".
	 *
	 * @return string
	 */
	public static function current_path() {
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '/';

		return self::normalize_path( $uri );
	}

	/**
	 * Strips the domain, query, fragment and home sub-directory; adds slashes.
	 *
	 * @param string $url URL or path.
	 * @return string
	 */
	public static function normalize_path( $url ) {
		$path = (string) wp_parse_url( $url, PHP_URL_PATH );
		$home = (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH );

		if ( '/' !== $home && 0 === strpos( $path, rtrim( $home, '/' ) ) ) {
			$path = substr( $path, strlen( rtrim( $home, '/' ) ) );
		}

		$path = '/' . trim( rawurldecode( $path ), '/' );

		return '/' === $path ? '/' : $path . '/';
	}

	/**
	 * Whether automatic triggers should skip the current (logged-in) visitor:
	 * the modal hides from logged-in users, or the user's role is excluded
	 * site-wide (mockup 5a "Don't show to").
	 *
	 * @param array<string, mixed> $rules Modal rules.
	 * @return bool
	 */
	public static function hidden_for_visitor( $rules ) {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		if ( ! empty( $rules['visitors']['hideLoggedIn'] ) ) {
			return true;
		}

		$excluded = (array) Settings::value( 'general', 'hideForRoles' );
		$user     = wp_get_current_user();

		return (bool) array_intersect( $excluded, (array) $user->roles );
	}

	/**
	 * Whether this request is an admin preview (?modal=preview), which
	 * bypasses every rule (mockup 7c).
	 *
	 * @return bool
	 */
	public static function is_preview() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only preview flag.
		$modal = isset( $_GET['modal'] ) ? sanitize_key( wp_unslash( $_GET['modal'] ) ) : '';

		$type = get_post_type_object( PostType::NAME );

		return ( 'preview' === $modal && $type && current_user_can( $type->cap->edit_others_posts ) ) || Preview::is_request();
	}

	/**
	 * The parts of a modal's rules the browser evaluates.
	 *
	 * @param array<string, mixed> $rules Modal rules.
	 * @return array<string, mixed>
	 */
	public static function for_browser( $rules ) {
		return array(
			'frequency'    => $rules['frequency'],
			'devices'      => $rules['devices'],
			'browsers'     => $rules['browsers'],
			'schedule'     => $rules['schedule'],
			'minPageViews' => (int) $rules['visitors']['minPageViews'],
		);
	}
}

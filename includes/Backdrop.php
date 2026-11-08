<?php
/**
 * The homepage behind the modal in the editor ("Site preview").
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * The editor shows the real homepage behind the modal being edited, in a
 * frame that runs no JavaScript. Its URL carries `modal_kit_backdrop` and a
 * nonce; for administrators and editors (filter
 * `modal_kit_backdrop_capability`) that request prints no modals, no admin
 * bar and no scripts, is never cached or indexed, and fires
 * `modal_kit_backdrop_request` so analytics that count on the server can
 * skip it. For anyone else the argument does nothing.
 */
final class Backdrop {

	/**
	 * Query argument.
	 */
	const ARG = 'modal_kit_backdrop';

	/**
	 * Nonce action.
	 */
	const NONCE = 'modal_kit_backdrop';

	/**
	 * Registers hooks (front end).
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'template_redirect', array( $this, 'prepare' ), 0 );
		add_filter(
			'show_admin_bar',
			static function ( $show ) {
				return self::is_request() ? false : $show;
			}
		);
	}

	/**
	 * Who may load the homepage as a backdrop.
	 *
	 * @return string Capability.
	 */
	public static function capability() {
		/**
		 * Filters the capability needed for the editor's homepage backdrop.
		 *
		 * @param string $capability Default: editors and administrators.
		 */
		return (string) apply_filters( 'modal_kit_backdrop_capability', 'edit_others_posts' );
	}

	/**
	 * The backdrop URL for the current user, or '' when they may not use it.
	 *
	 * @return string
	 */
	public static function url() {
		if ( ! current_user_can( self::capability() ) ) {
			return '';
		}

		return add_query_arg(
			array(
				self::ARG  => 1,
				'_wpnonce' => wp_create_nonce( self::NONCE ),
			),
			home_url( '/' )
		);
	}

	/**
	 * Whether this request is a valid backdrop request.
	 *
	 * @return bool
	 */
	public static function is_request() {
		if ( ! isset( $_GET[ self::ARG ], $_GET['_wpnonce'] ) || ! current_user_can( self::capability() ) ) {
			return false;
		}

		return (bool) wp_verify_nonce( sanitize_key( wp_unslash( $_GET['_wpnonce'] ) ), self::NONCE );
	}

	/**
	 * Keeps the request out of caches, search engines and analytics.
	 *
	 * @return void
	 */
	public function prepare() {
		if ( ! self::is_request() ) {
			return;
		}

		// Page caches (WP Super Cache, W3 Total Cache, LiteSpeed and others).
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Shared convention of caching plugins.
		}

		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow' );
		add_filter( 'wp_robots', 'wp_robots_no_robots' );

		// The frame can't run scripts anyway: don't send them.
		ob_start( array( __CLASS__, 'strip_scripts' ) );

		/**
		 * Fires on the editor's homepage backdrop request, which loads for
		 * administrators and editors only. Analytics that count visits on the
		 * server can skip it here.
		 */
		do_action( 'modal_kit_backdrop_request' );
	}

	/**
	 * Removes every script element, and links that preload scripts or script
	 * modules, from the page HTML.
	 *
	 * @param string $html Page HTML.
	 * @return string
	 */
	public static function strip_scripts( $html ) {
		return (string) preg_replace(
			array(
				'#<script\b[^>]*>.*?</script\s*>#is',
				'#<link\b[^>]*\brel=(["\']?)modulepreload\1[^>]*>#i',
				'#<link\b[^>]*\bas=(["\']?)script\1[^>]*>#i',
			),
			'',
			$html
		);
	}
}

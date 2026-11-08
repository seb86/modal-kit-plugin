<?php
/**
 * Keeps what the browser remembers separate for each site on a web address.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Sites in subfolders (a subdirectory network, or separate installs under one
 * domain) share one localStorage. Their keys carry the site's path, printed in
 * a meta tag so that it survives a static export. A site at the root of its
 * domain prints nothing and keeps plain `modal-kit:` keys.
 */
final class Storage {

	/**
	 * Name of the meta tag the runtime reads (src/runtime/storage.js).
	 */
	const META = 'modal-kit-scope';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'wp_head', array( self::class, 'print_scope' ), 1 );
		add_action( 'admin_head', array( self::class, 'print_scope' ), 1 );
	}

	/**
	 * This site's part of the keys: its path, or nothing at the domain's root.
	 * The saved option, because translation plugins filter home_url() and a
	 * language folder isn't another site.
	 *
	 * @return string Such as `/site2/`.
	 */
	public static function scope() {
		$path = wp_parse_url( (string) get_option( 'home' ), PHP_URL_PATH );
		$path = is_string( $path ) ? trim( $path, '/' ) : '';

		return '' === $path ? '' : '/' . $path . '/';
	}

	/**
	 * What every key starts with on this site.
	 *
	 * @return string
	 */
	public static function prefix() {
		return 'modal-kit:' . self::scope();
	}

	/**
	 * Prints the meta tag on sites in a subfolder.
	 *
	 * @return void
	 */
	public static function print_scope() {
		$scope = self::scope();

		if ( '' !== $scope ) {
			printf( '<meta name="%1$s" content="%2$s" />' . "\n", esc_attr( self::META ), esc_attr( $scope ) );
		}
	}
}

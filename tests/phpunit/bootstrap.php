<?php
/**
 * PHPUnit bootstrap. Uses the WordPress test library in WP_TESTS_DIR
 * (Laragon locally, /tmp/wordpress-tests-lib in CI).
 *
 * @package ModalKit
 */

$modal_kit_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $modal_kit_tests_dir ) {
	$modal_kit_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

if ( ! file_exists( $modal_kit_tests_dir . '/includes/functions.php' ) ) {
	echo "Could not find {$modal_kit_tests_dir}/includes/functions.php. Set WP_TESTS_DIR." . PHP_EOL; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	exit( 1 );
}

define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', dirname( __DIR__, 2 ) . '/vendor/yoast/phpunit-polyfills' );

require_once $modal_kit_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__, 2 ) . '/modal-kit.php';
	}
);

require $modal_kit_tests_dir . '/includes/bootstrap.php';

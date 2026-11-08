<?php
/**
 * Router for PHP's built-in server: serves the Laragon test site on another
 * port and PHP version, without touching its wp-config.php.
 *
 *   php -S localhost:8095 -t C:/laragon/www/modal-kit-tests bin/php-server-router.php
 *
 * then run Playwright with WP_BASE_URL=http://localhost:8095. The site root
 * comes from WP_TESTS_PATH (as in .env), defaulting to the Laragon test site.
 *
 * @package ModalKit
 */

$root = rtrim( str_replace( '\\', '/', getenv( 'WP_TESTS_PATH' ) ?: 'C:/laragon/www/modal-kit-tests' ), '/' );
$path = rawurldecode( (string) parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) );
$file = $root . $path;

if ( is_dir( $file ) ) {
	$file = rtrim( $file, '/' ) . '/index.php';
}

// Static files: let the server send them.
if ( is_file( $file ) && '.php' !== substr( $file, -4 ) ) {
	return false;
}

$port = (int) $_SERVER['SERVER_PORT'];
define( 'WP_HOME', 'http://localhost:' . $port );
define( 'WP_SITEURL', 'http://localhost:' . $port );
// The built-in server handles one request at a time: no loopback cron.
define( 'DISABLE_WP_CRON', true );

if ( ! is_file( $file ) ) {
	$file = $root . '/index.php'; // Pretty permalinks.
}

$_SERVER['SCRIPT_FILENAME'] = $file;
$_SERVER['SCRIPT_NAME']     = substr( $file, strlen( $root ) );
$_SERVER['PHP_SELF']        = $_SERVER['SCRIPT_NAME'];

chdir( dirname( $file ) );
require $file;

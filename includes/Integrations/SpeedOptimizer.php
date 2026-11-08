<?php
/**
 * SiteGround Speed Optimizer (BUILD-NOTES #116).
 *
 * @package ModalKit
 */

namespace ModalKit\Integrations;

use ModalKit\Plugin;

defined( 'ABSPATH' ) || exit;

/**
 * Speed Optimizer's "Combine JavaScript files" folds every script with a
 * src into one classic script, script modules included, so Modal Kit's
 * runtime (a module with imports) stops running. Core's own block modules
 * are on its exclusion list; this adds Modal Kit's folder, with no setting
 * needed.
 */
final class SpeedOptimizer {

	/**
	 * Registers hooks. Harmless when Speed Optimizer isn't active.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_filter( 'sgo_javascript_combine_excluded_internal_paths', array( __CLASS__, 'exclude' ) );
	}

	/**
	 * Adds the plugin's folder to the paths Speed Optimizer won't combine.
	 *
	 * @param mixed $paths Paths matched against each script's URL.
	 * @return array<int, string>
	 */
	public static function exclude( $paths ) {
		$paths   = is_array( $paths ) ? $paths : array();
		$paths[] = (string) wp_parse_url( Plugin::url( '' ), PHP_URL_PATH );

		return $paths;
	}
}

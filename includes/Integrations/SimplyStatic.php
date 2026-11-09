<?php
/**
 * Simply Static exports.
 *
 * @package ModalKit
 */

namespace ModalKit\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Simply Static copies the files a page references. Modal Kit's triggers and
 * video player are imported on demand from build/runtime/, so no page links
 * to them: this adds that folder to the export, with no setting needed.
 */
final class SimplyStatic {

	/**
	 * Registers hooks. Harmless when Simply Static isn't active.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_filter( 'ss_additional_files', array( $this, 'additional_files' ) );
	}

	/**
	 * Adds build/runtime/ (as a path inside wp-content/plugins, which is how
	 * Simply Static maps files to URLs, also when the plugin is symlinked).
	 *
	 * @param mixed $files Files and folders.
	 * @return array<int, string>
	 */
	public function additional_files( $files ) {
		$files   = is_array( $files ) ? $files : array();
		$runtime = trailingslashit( WP_PLUGIN_DIR ) . dirname( plugin_basename( MODAL_KIT_FILE ) ) . '/build/runtime';

		if ( is_dir( $runtime ) ) {
			$files[] = $runtime;
		}

		return $files;
	}
}

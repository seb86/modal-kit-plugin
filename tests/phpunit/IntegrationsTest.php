<?php
/**
 * Tests for the integrations with other plugins.
 *
 * @package ModalKit
 */

/**
 * @covers \ModalKit\Integrations\SpeedOptimizer
 */
class IntegrationsTest extends WP_UnitTestCase {

	/**
	 * Speed Optimizer's combine JavaScript leaves the plugin's script modules
	 * alone, and keeps the paths others added.
	 */
	public function test_speed_optimizer_does_not_combine_the_runtime() {
		$paths = apply_filters( 'sgo_javascript_combine_excluded_internal_paths', array( '/elsewhere/' ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Speed Optimizer's filter.

		$this->assertContains( '/elsewhere/', $paths );
		$this->assertContains( wp_parse_url( MODAL_KIT_URL, PHP_URL_PATH ), $paths );
		$this->assertStringEndsWith( '/modal-kit/', wp_parse_url( MODAL_KIT_URL, PHP_URL_PATH ) );
	}
}

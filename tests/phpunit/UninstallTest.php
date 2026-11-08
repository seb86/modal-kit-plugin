<?php
/**
 * The "delete everything" switch has to survive for a plugin that requires this
 * one, because the Plugins screen can delete this plugin first. Each test runs
 * in its own process: uninstall.php declares functions.
 *
 * @package ModalKit
 */

/**
 * Deleting Modal Kit before an add-on.
 */
class UninstallTest extends WP_UnitTestCase {

	/**
	 * A plugin file made for the test.
	 *
	 * @var string
	 */
	private $add_on = '';

	/**
	 * Removes the plugin file.
	 *
	 * @return void
	 */
	public function tear_down() {
		if ( '' !== $this->add_on && file_exists( $this->add_on ) ) {
			unlink( $this->add_on ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- Test file.
		}

		parent::tear_down();
	}

	/**
	 * Installs a plugin with some Requires Plugins header.
	 *
	 * @param string $requires Header value.
	 * @return void
	 */
	private function install_plugin_requiring( $requires ) {
		$this->add_on = trailingslashit( WP_PLUGIN_DIR ) . 'modal-kit-uninstall-test.php';

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Test file.
		file_put_contents( $this->add_on, "<?php\n/**\n * Plugin Name: Uninstall test\n * Requires Plugins: {$requires}\n */\n" );
		wp_cache_delete( 'plugins', 'plugins' );
	}

	/**
	 * Whether the switch's row is in the database. Settings have registered
	 * defaults, so get_option() can't tell.
	 *
	 * @return bool
	 */
	private function switch_is_stored() {
		global $wpdb;

		return null !== $wpdb->get_var( $wpdb->prepare( "SELECT option_id FROM {$wpdb->options} WHERE option_name = %s", 'modal_kit_tools' ) );
	}

	/**
	 * Runs uninstall.php.
	 *
	 * @return void
	 */
	private function uninstall() {
		update_option( 'modal_kit_tools', array( 'deleteOnUninstall' => true ) );

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'modal-kit/modal-kit.php' );
		}

		include MODAL_KIT_PATH . 'uninstall.php';
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 *
	 * @return void
	 */
	public function test_the_switch_stays_for_a_plugin_that_requires_this_one() {
		$this->install_plugin_requiring( 'woocommerce, modal-kit' );
		$this->uninstall();

		$this->assertTrue( $this->switch_is_stored(), 'It reads the switch when it is deleted.' );
		$this->assertFalse( get_option( 'modal_kit_wizard_done' ), 'Everything else still goes.' );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 *
	 * @return void
	 */
	public function test_the_switch_goes_when_nothing_requires_this_one() {
		$this->install_plugin_requiring( 'modal-kit-other' );
		$this->uninstall();

		$this->assertFalse( $this->switch_is_stored() );
	}
}

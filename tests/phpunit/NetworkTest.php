<?php
/**
 * What the readme promises about multisite networks. Run with
 * `npm run test:multisite`; skipped on a single site.
 *
 * @package ModalKit
 */

use ModalKit\PostType;
use ModalKit\Render;
use ModalKit\Settings;
use ModalKit\Wizard;

/**
 * Sites on a network.
 */
class NetworkTest extends WP_UnitTestCase {

	/**
	 * Skips on a single site.
	 *
	 * @return void
	 */
	public function set_up() {
		parent::set_up();

		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Needs a network: npm run test:multisite.' );
		}
	}

	/**
	 * Goes back to the main site, whatever a failed test left switched.
	 *
	 * @return void
	 */
	public function tear_down() {
		while ( ms_is_switched() ) {
			restore_current_blog();
		}

		parent::tear_down();
	}

	/**
	 * A published modal on the current site.
	 *
	 * @param string $slug    Slug.
	 * @param string $content Inner block markup.
	 * @return int Post ID.
	 */
	private function modal( $slug, $content = '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->' ) {
		return wp_insert_post(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => $slug,
				'post_title'   => $slug,
				'post_content' => '<!-- wp:modal-kit/modal -->' . $content . '<!-- /wp:modal-kit/modal -->',
			)
		);
	}

	/**
	 * The slugs of the current site's modals.
	 *
	 * @return string[]
	 */
	private function slugs() {
		return wp_list_pluck(
			get_posts(
				array(
					'post_type'   => PostType::NAME,
					'post_status' => 'any',
					'numberposts' => -1,
				)
			),
			'post_name'
		);
	}

	public function test_each_site_has_its_own_modals() {
		$two   = self::factory()->blog->create();
		$three = self::factory()->blog->create();

		switch_to_blog( $two );
		$this->modal( 'only-two' );
		$this->assertSame( array( 'only-two' ), $this->slugs() );
		$this->assertContains( 'only-two', wp_list_pluck( ( new Render() )->published(), 'post_name' ) );
		restore_current_blog();

		switch_to_blog( $three );
		$this->assertSame( array(), $this->slugs() );
		$this->assertSame( array(), ( new Render() )->published(), 'A modal from one site never prints on another.' );
		restore_current_blog();

		$this->assertNotContains( 'only-two', $this->slugs(), 'Nor on the main site.' );
	}

	public function test_each_site_has_its_own_settings() {
		$two = self::factory()->blog->create();

		$before = Settings::get( 'tools' );

		switch_to_blog( $two );
		update_option( Settings::PREFIX . 'tools', array( 'deleteOnUninstall' => true ) );
		$this->assertTrue( Settings::get( 'tools' )['deleteOnUninstall'] );
		restore_current_blog();

		$this->assertSame( $before, Settings::get( 'tools' ) );
	}

	public function test_a_site_administrator_only_manages_their_own_site() {
		$two   = self::factory()->blog->create();
		$three = self::factory()->blog->create();
		$user  = self::factory()->user->create();

		add_user_to_blog( $two, $user, 'administrator' );
		$publish = get_post_type_object( PostType::NAME )->cap->publish_posts;

		switch_to_blog( $three );
		$theirs = $this->modal( 'on-three' );
		wp_set_current_user( $user );
		$this->assertFalse( current_user_can( $publish ), 'Not a member here.' );
		$this->assertFalse( current_user_can( 'edit_post', $theirs ) );
		restore_current_blog();

		switch_to_blog( $two );
		wp_set_current_user( $user );
		$this->assertTrue( current_user_can( $publish ), 'Works on a site made after the plugin was active.' );
		$this->assertTrue( current_user_can( 'edit_post', $this->modal( 'on-two' ) ) );
		restore_current_blog();
	}

	public function test_only_a_super_admin_can_save_scripts_in_a_modal() {
		$two     = self::factory()->blog->create();
		$admin   = self::factory()->user->create();
		$super   = self::factory()->user->create();
		$content = '<!-- wp:html --><script>window.sneaky = 1;</script><p data-wp-bind--hidden="state.x">Kept</p><!-- /wp:html -->';

		add_user_to_blog( $two, $admin, 'administrator' );
		add_user_to_blog( $two, $super, 'administrator' );
		grant_super_admin( $super );

		switch_to_blog( $two );

		wp_set_current_user( $admin );
		$this->assertFalse( current_user_can( 'unfiltered_html' ) );
		$saved = get_post( $this->modal( 'by-admin', $content ) )->post_content;
		$this->assertStringNotContainsString( '<script', $saved );
		$this->assertStringNotContainsString( 'data-wp-bind', $saved );
		$this->assertStringContainsString( 'Kept', $saved, 'Everything else stays.' );

		wp_set_current_user( $super );
		$this->assertTrue( current_user_can( 'unfiltered_html' ) );
		$this->assertStringContainsString( '<script', get_post( $this->modal( 'by-super', $content ) )->post_content );

		restore_current_blog();
		revoke_super_admin( $super );
	}

	public function test_the_setup_wizard_only_follows_activating_one_site() {
		$two   = self::factory()->blog->create();
		$three = self::factory()->blog->create();

		switch_to_blog( $two );
		delete_transient( Wizard::TRANSIENT );
		Wizard::activate( true );
		$this->assertFalse( get_transient( Wizard::TRANSIENT ), 'Network activation goes to no one site.' );

		Wizard::activate( false );
		$this->assertNotFalse( get_transient( Wizard::TRANSIENT ) );
		restore_current_blog();

		switch_to_blog( $three );
		$this->assertFalse( get_transient( Wizard::TRANSIENT ), 'Only the site that activated it.' );
		restore_current_blog();
	}

	/**
	 * In its own process: uninstall.php declares a function, and SecurityTest
	 * includes the file too.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 *
	 * @return void
	 */
	public function test_on_uninstall_each_site_decides_for_itself() {
		$removes = self::factory()->blog->create();
		$keeps   = self::factory()->blog->create();
		$user    = self::factory()->user->create();

		update_user_meta( $user, 'modal_kit_dismissed', array( 'a' ) );

		$main = $this->modal( 'on-main' );

		switch_to_blog( $removes );
		$this->modal( 'removed' );
		update_option( Settings::PREFIX . 'tools', array( 'deleteOnUninstall' => true ) );
		update_option( Wizard::DONE, 1 );
		restore_current_blog();

		switch_to_blog( $keeps );
		$this->modal( 'kept' );
		update_option( Settings::PREFIX . 'tools', array( 'deleteOnUninstall' => false ) );
		update_option( Wizard::DONE, 1 );
		restore_current_blog();

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'modal-kit/modal-kit.php' );
		}

		include MODAL_KIT_PATH . 'uninstall.php';

		global $wpdb;

		switch_to_blog( $removes );
		$this->assertSame( array(), $this->slugs() );
		$this->assertFalse( get_option( Wizard::DONE ), 'Its settings go too.' );
		// Settings have registered defaults, so ask the database, not get_option().
		$this->assertNull(
			$wpdb->get_var( $wpdb->prepare( "SELECT option_id FROM {$wpdb->options} WHERE option_name = %s", Settings::PREFIX . 'tools' ) )
		);
		restore_current_blog();

		switch_to_blog( $keeps );
		$this->assertSame( array( 'kept' ), $this->slugs() );
		$this->assertNotFalse( get_option( Wizard::DONE ), 'This site keeps its settings.' );
		restore_current_blog();

		$this->assertNotNull( get_post( $main ), 'The main site never asked.' );
		$this->assertFalse( metadata_exists( 'user', $user, 'modal_kit_dismissed' ), 'Users are shared, so their preference goes.' );
	}
}

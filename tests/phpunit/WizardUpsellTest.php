<?php
/**
 * Tests for the setup wizard and upgrade listings.
 *
 * @package ModalKit
 */

use ModalKit\Settings;
use ModalKit\Upsell;
use ModalKit\Wizard;

/**
 * @covers \ModalKit\Wizard
 * @covers \ModalKit\Upsell
 */
class WizardUpsellTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();
		( new Upsell() )->register_meta();
		Settings::flush();
		delete_option( Wizard::DONE );
		delete_transient( Wizard::TRANSIENT );
	}

	public function test_activation_asks_for_the_wizard_once() {
		Wizard::activate( false );
		$this->assertSame( 1, (int) get_transient( Wizard::TRANSIENT ) );

		delete_transient( Wizard::TRANSIENT );
		Wizard::activate( true );
		$this->assertFalse( get_transient( Wizard::TRANSIENT ), 'Network activation skips the wizard.' );

		update_option( Wizard::DONE, time() );
		Wizard::activate( false );
		$this->assertFalse( get_transient( Wizard::TRANSIENT ), 'Setup already ran.' );
	}

	public function test_setup_endpoint_marks_it_done_for_admins_only() {
		$request = new WP_REST_Request( 'POST', '/modal-kit/v1/setup' );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->assertSame( 403, rest_get_server()->dispatch( $request )->get_status() );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->assertSame( 200, rest_get_server()->dispatch( $request )->get_status() );
		$this->assertNotEmpty( get_option( Wizard::DONE ) );
	}

	public function test_listings_respect_the_pro_tips_switch() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->assertNotEmpty( Upsell::listings( 'button-action' ) );
		$this->assertSame( array( 'audience-rules' ), wp_list_pluck( Upsell::listings( 'rules' ), 'key' ) );

		update_option( 'modal_kit_pro', array( 'showProTips' => false ) );
		Settings::flush();

		$this->assertSame( array(), Upsell::listings() );
	}

	public function test_not_now_hides_a_listing_for_thirty_days() {
		$user = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $user );

		update_user_meta( $user, Upsell::DISMISSED, array( 'go-to-step' => time() + DAY_IN_SECONDS ) );
		$keys = wp_list_pluck( Upsell::listings( 'button-action' ), 'key' );
		$this->assertNotContains( 'go-to-step', $keys );
		$this->assertContains( 'step-nav', $keys );

		update_user_meta( $user, Upsell::DISMISSED, array( 'go-to-step' => time() - 1 ) );
		$this->assertContains( 'go-to-step', wp_list_pluck( Upsell::listings( 'button-action' ), 'key' ) );
	}

	public function test_woocommerce_triggers_need_woocommerce() {
		$this->assertSame( class_exists( 'WooCommerce' ), (bool) Upsell::listings( 'trigger' ) );
	}

	public function test_pro_can_remove_listings() {
		add_filter( 'modal_kit_pro_listings', '__return_empty_array' );

		$this->assertSame( array(), Upsell::listings() );

		remove_filter( 'modal_kit_pro_listings', '__return_empty_array' );
	}

	public function test_one_go_pro_link_unless_pro_is_active() {
		$links = ( new Upsell() )->plugin_link( array( 'deactivate' => '<a>Deactivate</a>' ) );

		$this->assertArrayHasKey( 'go_pro', $links );
		$this->assertCount( 2, $links );
	}
}

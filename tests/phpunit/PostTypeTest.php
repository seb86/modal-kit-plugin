<?php
/**
 * Tests for the mk_modal post type.
 *
 * @package ModalKit
 */

use ModalKit\PostType;
use ModalKit\Settings;

/**
 * @covers \ModalKit\PostType
 */
class PostTypeTest extends WP_UnitTestCase {

	public function test_post_type_is_registered() {
		$this->assertTrue( post_type_exists( PostType::NAME ) );
	}

	public function test_post_type_is_private_but_in_rest() {
		$object = get_post_type_object( PostType::NAME );

		$this->assertFalse( $object->public );
		$this->assertFalse( $object->publicly_queryable );
		$this->assertTrue( $object->show_ui );
		$this->assertTrue( $object->show_in_rest );
		$this->assertTrue( post_type_supports( PostType::NAME, 'custom-fields' ) );
	}

	public function test_template_is_one_locked_modal_block() {
		$object = get_post_type_object( PostType::NAME );

		$this->assertCount( 1, $object->template );
		$this->assertSame( 'modal-kit/modal', $object->template[0][0] );
		$this->assertTrue( $object->template[0][1]['lock']['move'] );
		$this->assertTrue( $object->template[0][1]['lock']['remove'] );
	}

	public function test_new_modals_get_the_default_overlay_color() {
		$display = Settings::sanitize(
			'display',
			array_merge(
				Settings::get( 'display' ),
				array(
					'overlayColor'       => '',
					'overlayCustomColor' => 'rgba(10, 20, 30, 0.6)',
				)
			)
		);
		$this->assertSame( 'rgba(10, 20, 30, 0.6)', $display['overlayCustomColor'] );

		update_option( Settings::PREFIX . 'display', $display );
		$overlay = PostType::template_attributes()['overlay'];
		$this->assertSame( 'rgba(10, 20, 30, 0.6)', $overlay['customColor'] );

		// Anything that isn't a plain color falls back to "none".
		$bad = Settings::sanitize( 'display', array( 'overlayCustomColor' => 'red;background:url(x)' ) );
		$this->assertSame( '', $bad['overlayCustomColor'] );
	}

	public function test_capabilities_follow_post_roles() {
		$editor      = self::factory()->user->create( array( 'role' => 'editor' ) );
		$contributor = self::factory()->user->create( array( 'role' => 'contributor' ) );
		$subscriber  = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$cap         = get_post_type_object( PostType::NAME )->cap;

		$this->assertTrue( user_can( $editor, $cap->publish_posts ) );
		$this->assertTrue( user_can( $contributor, $cap->edit_posts ) );
		$this->assertFalse( user_can( $contributor, $cap->publish_posts ) );
		$this->assertFalse( user_can( $subscriber, $cap->edit_posts ) );
	}

	public function test_admin_menu_is_labelled() {
		$labels = get_post_type_object( PostType::NAME )->labels;

		$this->assertSame( 'Modals', $labels->name );
		$this->assertSame( 'Modal Kit', $labels->menu_name );
		$this->assertSame( 'All Modals', $labels->all_items );
		$this->assertSame( 'Add New Modal', $labels->add_new_item );
	}
}

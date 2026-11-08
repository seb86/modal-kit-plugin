<?php
/**
 * Tests for modal meta registration and validation.
 *
 * @package ModalKit
 */

use ModalKit\Meta;
use ModalKit\PostType;

/**
 * @covers \ModalKit\Meta
 */
class MetaTest extends WP_UnitTestCase {

	/**
	 * Editor user ID.
	 *
	 * @var int
	 */
	private static $editor;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$editor = $factory->user->create( array( 'role' => 'editor' ) );
	}

	public function set_up() {
		parent::set_up();

		// The test framework unregisters all meta keys after each test.
		( new Meta() )->register();
	}

	public function test_meta_keys_are_registered_for_rest() {
		$registered = get_registered_meta_keys( 'post', PostType::NAME );

		foreach ( Meta::KEYS as $key ) {
			$this->assertArrayHasKey( Meta::PREFIX . $key, $registered );
			$this->assertIsArray( $registered[ Meta::PREFIX . $key ]['show_in_rest']['schema'] );
		}
	}

	public function test_defaults_are_valid_against_their_schema() {
		foreach ( Meta::KEYS as $key ) {
			$schema = Meta::schema( $key );

			$this->assertTrue( rest_validate_value_from_schema( $schema['default'], $schema ), $key );
		}
	}

	public function test_get_returns_defaults_for_a_new_modal() {
		$post_id = self::factory()->post->create( array( 'post_type' => PostType::NAME ) );
		$rules   = Meta::get( $post_id, 'rules' );

		$this->assertSame( array(), Meta::get( $post_id, 'triggers' ) );
		$this->assertSame( 'all', $rules['showOn']['mode'] );
		$this->assertSame( 7, $rules['frequency']['days'] );
	}

	public function test_get_fills_missing_keys_from_defaults() {
		$post_id = self::factory()->post->create( array( 'post_type' => PostType::NAME ) );
		update_post_meta( $post_id, Meta::PREFIX . 'rules', array( 'frequency' => array( 'mode' => 'always' ) ) );

		$rules = Meta::get( $post_id, 'rules' );

		$this->assertSame( 'always', $rules['frequency']['mode'] );
		$this->assertSame( 7, $rules['frequency']['days'] );
		$this->assertSame( array( 'desktop', 'tablet', 'mobile' ), $rules['devices'] );
	}

	public function test_invalid_values_fall_back_to_the_default() {
		$post_id = self::factory()->post->create( array( 'post_type' => PostType::NAME ) );
		update_post_meta( $post_id, Meta::PREFIX . 'triggers', array( array( 'type' => 'telepathy' ) ) );

		$this->assertSame( array(), get_post_meta( $post_id, Meta::PREFIX . 'triggers', true ) );

		// An unknown browser or a cap out of range: the rules fall back too.
		$default = Meta::schema( 'rules' )['default'];
		$rules   = $default;

		$rules['browsers'] = array(
			'mode' => 'only',
			'list' => array( 'netscape' ),
		);
		update_post_meta( $post_id, Meta::PREFIX . 'rules', $rules );
		$this->assertSame( $default['browsers'], Meta::get( $post_id, 'rules' )['browsers'] );

		$rules                          = $default;
		$rules['frequency']['maxShows'] = 500;
		update_post_meta( $post_id, Meta::PREFIX . 'rules', $rules );
		$this->assertSame( 0, Meta::get( $post_id, 'rules' )['frequency']['maxShows'] );
	}

	public function test_rest_accepts_valid_and_rejects_invalid_triggers() {
		wp_set_current_user( self::$editor );
		$post_id = self::factory()->post->create( array( 'post_type' => PostType::NAME ) );
		$route   = '/wp/v2/' . PostType::NAME . '/' . $post_id;

		$request = new WP_REST_Request( 'POST', $route );
		$request->set_body_params(
			array(
				'meta' => array(
					Meta::PREFIX . 'triggers' => array(
						array(
							'type'    => 'scroll',
							'percent' => 50,
						),
					),
				),
			)
		);
		$response = rest_get_server()->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 50, get_post_meta( $post_id, Meta::PREFIX . 'triggers', true )[0]['percent'] );

		$request = new WP_REST_Request( 'POST', $route );
		$request->set_body_params(
			array(
				'meta' => array(
					Meta::PREFIX . 'triggers' => array(
						array(
							'type'    => 'scroll',
							'percent' => 250,
						),
					),
				),
			)
		);

		$this->assertSame( 400, rest_get_server()->dispatch( $request )->get_status() );
	}

	public function test_meta_is_hidden_from_users_who_cannot_edit() {
		$post_id = self::factory()->post->create( array( 'post_type' => PostType::NAME ) );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$this->assertFalse( current_user_can( 'edit_post_meta', $post_id, Meta::PREFIX . 'rules' ) );
	}
}

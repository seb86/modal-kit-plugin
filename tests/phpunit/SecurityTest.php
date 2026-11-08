<?php
/**
 * Regression tests for the security review before the first release
 * (BUILD-NOTES #188). Each test replays what an attacker would do.
 *
 * @package ModalKit
 */

use ModalKit\Admin\ModalList;
use ModalKit\Layouts;
use ModalKit\PostType;
use ModalKit\Render;
use ModalKit\Rest\Tools;
use ModalKit\Rules;
use ModalKit\Settings;
use ModalKit\Upsell;
use ModalKit\UserStyles;
use ModalKit\Video;

/**
 * @covers \ModalKit\Hardening
 * @covers \ModalKit\Rest\Modals
 * @covers \ModalKit\Layouts
 * @covers \ModalKit\PostType
 */
class SecurityTest extends WP_UnitTestCase {

	/**
	 * Creates a user with a role and logs in as them.
	 *
	 * @param string $role Role.
	 * @return int User id.
	 */
	private function login_as( $role ) {
		$id = self::factory()->user->create( array( 'role' => $role ) );
		wp_set_current_user( $id );

		return $id;
	}

	/**
	 * Creates a published modal.
	 *
	 * @param array<string, mixed> $args Post fields.
	 * @return WP_Post
	 */
	private function modal( $args = array() ) {
		return self::factory()->post->create_and_get(
			array_merge(
				array(
					'post_type'    => PostType::NAME,
					'post_status'  => 'publish',
					'post_title'   => 'Launch',
					'post_content' => '<!-- wp:modal-kit/modal --><div class="wp-block-modal-kit-modal"><!-- wp:paragraph --><p>SECRET-CODE</p><!-- /wp:paragraph --></div><!-- /wp:modal-kit/modal -->',
				),
				$args
			)
		);
	}

	/**
	 * Sends a REST request.
	 *
	 * @param string $method Method.
	 * @param string $route  Route.
	 * @return WP_REST_Response
	 */
	private function rest( $method, $route ) {
		return rest_do_request( new WP_REST_Request( $method, $route ) );
	}

	public function test_kses_cleans_script_addresses_from_video_links() {
		$this->login_as( 'author' );

		$clean = wp_kses_post( '<a href="#" data-modal-kit-video="javascript:alert(1)">x</a>' );

		$this->assertStringNotContainsString( 'javascript:', $clean );
		$this->assertStringContainsString(
			'https://youtu.be/x',
			wp_kses_post( '<a href="#" data-modal-kit-video="https://youtu.be/x">x</a>' )
		);
	}

	public function test_only_trusted_users_keep_directives_in_modals() {
		$content = '<!-- wp:html --><a id="x" href="#" data-wp-interactive="modal-kit" data-wp-bind--style="state.x" data-keep="1">Keep me</a><!-- /wp:html -->';

		$this->login_as( 'contributor' );
		$saved = get_post(
			wp_insert_post(
				array(
					'post_type'    => PostType::NAME,
					'post_status'  => 'draft',
					'post_title'   => 'Draft',
					'post_content' => wp_slash( $content ),
				)
			)
		)->post_content;

		$this->assertStringNotContainsString( 'data-wp-', $saved );
		$this->assertStringContainsString( 'Keep me', $saved );
		$this->assertStringContainsString( 'data-keep="1"', $saved );
		$this->assertStringContainsString( '<!-- wp:html -->', $saved );
	}

	public function test_directives_in_posts_are_left_alone() {
		$this->login_as( 'author' );

		$saved = get_post(
			wp_insert_post(
				array(
					'post_status'  => 'draft',
					'post_title'   => 'Post',
					'post_content' => wp_slash( '<a href="#" data-wp-interactive="other">x</a>' ),
				)
			)
		)->post_content;

		$this->assertStringContainsString( 'data-wp-interactive', $saved );
	}

	public function test_visitors_can_not_read_modals_over_rest() {
		$modal = $this->modal();

		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->rest( 'GET', '/wp/v2/mk_modal' )->get_status() );
		$this->assertSame( 401, $this->rest( 'GET', '/wp/v2/mk_modal/' . $modal->ID )->get_status() );

		$this->login_as( 'subscriber' );
		$this->assertSame( 403, $this->rest( 'GET', '/wp/v2/mk_modal' )->get_status() );
		$this->assertSame( 403, $this->rest( 'GET', '/wp/v2/mk_modal/' . $modal->ID )->get_status() );

		$this->login_as( 'editor' );
		$this->assertSame( 200, $this->rest( 'GET', '/wp/v2/mk_modal' )->get_status() );
		$this->assertSame( 200, $this->rest( 'GET', '/wp/v2/mk_modal/' . $modal->ID )->get_status() );
	}

	public function test_only_editors_and_above_can_publish_modals() {
		$cap = get_post_type_object( PostType::NAME )->cap;

		$author = $this->login_as( 'author' );
		$this->assertTrue( user_can( $author, $cap->edit_posts ), 'Authors can still draft.' );
		$this->assertFalse( user_can( $author, $cap->publish_posts ) );
		$this->assertFalse( user_can( $author, $cap->edit_published_posts ) );
		$this->assertFalse( user_can( $author, $cap->delete_published_posts ) );

		$own = $this->modal( array( 'post_author' => $author ) );
		$this->assertFalse( current_user_can( 'edit_post', $own->ID ), 'Nor change one that is live.' );

		$editor = $this->login_as( 'editor' );
		$this->assertTrue( user_can( $editor, $cap->publish_posts ) );
		$this->assertTrue( user_can( $editor, $cap->edit_published_posts ) );
		$this->assertTrue( user_can( $editor, $cap->delete_published_posts ) );
	}

	/**
	 * Values a hand-written block comment can give any attribute.
	 *
	 * @return array<string, array<int, mixed>>
	 */
	public function malformed_values() {
		return array(
			'empty array' => array( array() ),
			'object'      => array( array( 'x' => 1 ) ),
			'number'      => array( 7 ),
			'boolean'     => array( true ),
			'null'        => array( null ),
		);
	}

	/**
	 * @dataProvider malformed_values
	 *
	 * @param mixed $value Value given to every attribute in turn.
	 */
	public function test_malformed_attributes_never_crash( $value ) {
		$block = json_decode( (string) file_get_contents( MODAL_KIT_PATH . 'src/blocks/modal/block.json' ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- A local file.

		foreach ( array_keys( $block['attributes'] ) as $name ) {
			$attributes = array( $name => $value );
			$post       = $this->modal(
				array(
					'post_content' => '<!-- wp:modal-kit/modal ' . wp_json_encode( $attributes ) . ' --><div class="wp-block-modal-kit-modal"></div><!-- /wp:modal-kit/modal -->',
				)
			);

			$this->assertIsArray( Layouts::resolve( $attributes ), $name );
			$this->assertIsString( Render::dialog( $post ), $name );
			$this->assertIsString( ModalList::shows_on_summary( $post ), $name );

			wp_delete_post( $post->ID, true );
		}
	}

	public function test_modal_list_hides_titles_the_user_can_not_read() {
		$private = self::factory()->post->create(
			array(
				'post_status' => 'private',
				'post_title'  => 'Private merger plans',
			)
		);
		$public  = self::factory()->post->create(
			array(
				'post_status' => 'publish',
				'post_title'  => 'Public page',
			)
		);
		$modal   = $this->modal();

		update_post_meta(
			$modal->ID,
			'_modal_kit_rules',
			array(
				'showOn' => array(
					'mode'    => 'include',
					'include' => array( 'post:' . $private, 'post:' . $public ),
					'exclude' => array(),
				),
			)
		);

		$this->login_as( 'contributor' );
		$summary = ModalList::shows_on_summary( get_post( $modal->ID ) );
		$this->assertStringNotContainsString( 'Private merger plans', $summary );
		$this->assertStringContainsString( 'Public page', $summary );

		$this->login_as( 'administrator' );
		$this->assertStringContainsString( 'Private merger plans', ModalList::shows_on_summary( get_post( $modal->ID ) ) );
	}

	public function test_preview_flag_needs_more_than_writing_posts() {
		$_GET['modal'] = 'preview';

		$this->login_as( 'contributor' );
		$contributor = Rules::is_preview();

		$this->login_as( 'author' );
		$author = Rules::is_preview();

		$this->login_as( 'editor' );
		$editor = Rules::is_preview();

		unset( $_GET['modal'] );

		$this->assertFalse( $contributor );
		$this->assertFalse( $author );
		$this->assertTrue( $editor );
	}

	public function test_password_protected_modals_are_not_printed() {
		$open   = $this->modal();
		$locked = $this->modal( array( 'post_password' => 'secret' ) );

		$ids = wp_list_pluck( ( new Render() )->published(), 'ID' );

		$this->assertContains( $open->ID, $ids );
		$this->assertNotContains( $locked->ID, $ids );
	}

	/**
	 * Imports an export file.
	 *
	 * @param array<string, mixed> $data Export data.
	 * @return array<string, mixed>
	 */
	private function import( $data ) {
		$request = new WP_REST_Request( 'POST', '/modal-kit/v1/import' );
		$request->set_param( 'data', array_merge( array( 'plugin' => 'modal-kit' ), $data ) );
		$request->set_param( 'replace', true );

		return ( new Tools() )->import( $request )->get_data();
	}

	public function test_import_never_stores_scripts() {
		$this->login_as( 'administrator' );
		$content = '<!-- wp:modal-kit/modal {"modalLayout":"drawer"} --><div class="wp-block-modal-kit-modal"><!-- wp:html --><p data-wp-bind--style="state.x" onclick="alert(1)">Hello</p><script>alert(1)</script><!-- /wp:html --></div><!-- /wp:modal-kit/modal -->';

		$result = $this->import(
			array(
				'modals' => array(
					array(
						'slug'    => 'imported',
						'title'   => 'Imported',
						'status'  => 'publish',
						'content' => $content,
					),
				),
			)
		);
		$this->assertSame( 1, $result['created'] );

		$post = get_page_by_path( 'imported', OBJECT, PostType::NAME );
		$this->assertStringNotContainsString( '<script', $post->post_content );
		$this->assertStringNotContainsString( 'onclick', $post->post_content );
		$this->assertStringNotContainsString( 'data-wp-', $post->post_content );
		$this->assertStringContainsString( 'Hello', $post->post_content );

		$blocks = parse_blocks( $post->post_content );
		$this->assertSame( 'drawer', $blocks[0]['attrs']['modalLayout'], 'Block attributes survive.' );
		$this->assertSame( 'publish', $post->post_status, 'A moved modal stays live.' );
	}

	public function test_import_and_export_leave_delete_on_uninstall_alone() {
		$this->login_as( 'administrator' );

		update_option( Settings::PREFIX . 'tools', array( 'deleteOnUninstall' => false ) );
		$this->import(
			array(
				'modals'   => array(),
				'settings' => array( 'tools' => array( 'deleteOnUninstall' => true ) ),
			)
		);
		$this->assertFalse( Settings::get( 'tools' )['deleteOnUninstall'], 'A shared file can not arm it.' );

		update_option( Settings::PREFIX . 'tools', array( 'deleteOnUninstall' => true ) );
		$this->import(
			array(
				'modals'   => array(),
				'settings' => array( 'tools' => array( 'deleteOnUninstall' => false ) ),
			)
		);
		$this->assertTrue( Settings::get( 'tools' )['deleteOnUninstall'], 'Nor disarm it.' );

		$export = ( new Tools() )->export( new WP_REST_Request( 'GET', '/modal-kit/v1/export' ) );
		$this->assertArrayNotHasKey( 'deleteOnUninstall', $export->get_data()['settings']['tools'] ?? array() );
	}

	public function test_dismissals_are_private_to_the_user() {
		( new Upsell() )->register_meta();

		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		self::factory()->post->create(
			array(
				'post_author' => $author,
				'post_status' => 'publish',
			)
		);
		update_user_meta( $author, 'modal_kit_dismissed', array( 'collections' => 4102444800 ) );

		wp_set_current_user( 0 );
		$public = $this->rest( 'GET', '/wp/v2/users/' . $author )->get_data();
		$this->assertArrayNotHasKey( 'modal_kit_dismissed', $public['meta'] ?? array() );

		wp_set_current_user( $author );
		$own = $this->rest( 'GET', '/wp/v2/users/me' )->get_data();
		$this->assertSame( array( 'collections' => 4102444800 ), $own['meta']['modal_kit_dismissed'] );
	}

	public function test_only_web_addresses_count_as_video_services() {
		$this->assertSame( 'youtube', Video::provider( 'https://www.youtube.com/watch?v=x' ) );
		$this->assertSame( 'vimeo', Video::provider( 'http://vimeo.com/1' ) );
		$this->assertSame( 'youtube', Video::provider( '//www.youtube.com/embed/x' ) );
		$this->assertSame( '', Video::provider( 'javascript://www.youtube.com/%0Aalert(1)' ) );
		$this->assertSame( '', Video::provider( 'data://vimeo.com/x' ) );
	}

	public function test_reassigning_a_style_keeps_the_block_intact() {
		$this->login_as( 'administrator' );

		$modal = $this->modal(
			array(
				'post_content' => wp_slash( '<!-- wp:modal-kit/modal {"className":"is-style-old","metadata":{"name":"say \"hi\""}} --><div class="wp-block-modal-kit-modal is-style-old"></div><!-- /wp:modal-kit/modal -->' ),
			)
		);

		UserStyles::reassign( 'old', 'default' );

		$content = get_post( $modal->ID )->post_content;
		$blocks  = parse_blocks( $content );

		$this->assertSame( 'modal-kit/modal', $blocks[0]['blockName'] );
		$this->assertSame( 'say "hi"', $blocks[0]['attrs']['metadata']['name'], 'Backslashes survive, and so does the JSON.' );
		$this->assertArrayNotHasKey( 'className', $blocks[0]['attrs'] );
	}

	public function test_uninstall_removes_everything_when_asked() {
		$this->login_as( 'administrator' );

		$live    = $this->modal();
		$trashed = $this->modal( array( 'post_status' => 'trash' ) );

		update_option( 'modal_kit_tools', array( 'deleteOnUninstall' => true ) );
		update_option( UserStyles::OPTION, array( 'a' => array() ) );

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'modal-kit/modal-kit.php' );
		}

		include MODAL_KIT_PATH . 'uninstall.php';

		$this->assertNull( get_post( $live->ID ) );
		$this->assertNull( get_post( $trashed->ID ), 'Trashed modals go too.' );

		// Settings have registered defaults, so ask the database, not get_option().
		global $wpdb;
		foreach ( array( UserStyles::OPTION, 'modal_kit_tools' ) as $option ) {
			$this->assertNull(
				$wpdb->get_var( $wpdb->prepare( "SELECT option_id FROM {$wpdb->options} WHERE option_name = %s", $option ) ),
				$option
			);
		}
	}
}

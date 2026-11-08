<?php
/**
 * Tests for the admin screens' server parts: list summaries, accessibility
 * settings, export / import and the preview.
 *
 * @package ModalKit
 */

use ModalKit\Accessibility;
use ModalKit\Admin\ModalList;
use ModalKit\Meta;
use ModalKit\PostType;
use ModalKit\Preview;
use ModalKit\Settings;

/**
 * @covers \ModalKit\Admin\ModalList
 * @covers \ModalKit\Accessibility
 * @covers \ModalKit\Rest\Tools
 * @covers \ModalKit\Preview
 */
class AdminTest extends WP_UnitTestCase {

	/**
	 * Administrator ID.
	 *
	 * @var int
	 */
	private static $admin;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin = $factory->user->create( array( 'role' => 'administrator' ) );
	}

	public function set_up() {
		parent::set_up();
		( new Meta() )->register();
		Settings::flush();
	}

	/**
	 * Creates a modal.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param array<string, mixed> $meta       Meta by key.
	 * @param string               $slug       Slug.
	 * @return WP_Post
	 */
	private function modal( $attributes = array(), $meta = array(), $slug = 'autumn-sale' ) {
		$post = self::factory()->post->create_and_get(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => $slug,
				'post_title'   => 'Autumn sale',
				'post_content' => '<!-- wp:modal-kit/modal ' . wp_json_encode( (object) $attributes ) . ' --><!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph --><!-- /wp:modal-kit/modal -->',
			)
		);

		foreach ( $meta as $key => $value ) {
			update_post_meta( $post->ID, Meta::PREFIX . $key, $value );
		}

		return $post;
	}

	public function test_list_summaries() {
		$post = $this->modal(
			array( 'modalLayout' => 'drawer' ),
			array(
				'triggers' => array(
					array(
						'type'    => 'scroll',
						'percent' => 50,
					),
					array(
						'type'   => 'element',
						'anchor' => 'workshops',
					),
				),
				'rules'    => array(
					'showOn' => array(
						'mode'    => 'include',
						'include' => array( '/workshops/*', '/' ),
						'exclude' => array( '/workshops/old/' ),
					),
				),
			)
		);

		$this->assertSame( 'Drawer', ModalList::layout_label( $post ) );
		$this->assertSame( 'Scroll 50%, Element in view #workshops, Click #modal-autumn-sale', ModalList::triggers_summary( $post ) );
		$this->assertSame( '/workshops/*, Home, except /workshops/old/', ModalList::shows_on_summary( $post ) );
	}

	public function test_every_layout_has_a_label() {
		foreach ( array( 'centered', 'corner', 'bar', 'full', 'drawer', 'split', 'sheet', 'inline', 'video' ) as $layout ) {
			$post = $this->modal( array( 'modalLayout' => $layout ), array(), 'layout-' . $layout );
			$this->assertNotSame( '', ModalList::layout_label( $post ), $layout );
		}

		$this->assertSame( 'Video', ModalList::layout_label( $this->modal( array( 'modalLayout' => 'video' ), array(), 'video-two' ) ) );
	}

	public function test_shows_on_names_picked_pages_and_exceptions() {
		$about = self::factory()->post->create(
			array(
				'post_type'  => 'page',
				'post_title' => 'About',
			)
		);
		$post  = $this->modal(
			array(),
			array(
				'rules' => array(
					'showOn' => array(
						'mode'    => 'exclude',
						'include' => array( '/kept/' ),
						'exclude' => array( 'post:' . $about, '/checkout/*' ),
					),
				),
			)
		);
		$this->assertSame( 'Entire site, except About, /checkout/*', ModalList::shows_on_summary( $post ) );

		// "Only these pages" without a section: exceptions don't count.
		$pages = $this->modal(
			array(),
			array(
				'rules' => array(
					'showOn' => array(
						'mode'    => 'include',
						'include' => array( 'post:' . $about, '/' ),
						'exclude' => array( '/about/' ),
					),
				),
			),
			'pages-only'
		);
		$this->assertSame( 'About, Home', ModalList::shows_on_summary( $pages ) );
	}

	public function test_active_and_scheduled_views() {
		$active    = $this->modal( array(), array(), 'active' );
		$off       = $this->modal( array(), array( 'enabled' => false ), 'off' );
		$scheduled = $this->modal(
			array(),
			array(
				'rules' => array(
					'schedule' => array(
						'start' => gmdate( 'c', time() + DAY_IN_SECONDS ),
						'end'   => '',
					),
				),
			),
			'later'
		);

		$this->assertSame( array( $active->ID ), ModalList::ids_for_view( 'active' ) );
		$this->assertSame( array( $scheduled->ID ), ModalList::ids_for_view( 'scheduled' ) );
		$this->assertFalse( Meta::get( $off->ID, 'enabled' ) );
	}

	public function test_accessibility_merges_site_defaults_and_overrides() {
		update_option(
			'modal_kit_accessibility',
			array(
				'closeLabel'     => 'Dismiss',
				'allowAutoClose' => true,
			)
		);
		Settings::flush();

		$post = $this->modal(
			array(),
			array(
				'overrides' => array(
					'accessibility' => array(
						'focus'          => 'close',
						'autoClose'      => true,
						'autoCloseDelay' => 8,
					),
				),
			)
		);

		$a11y = Accessibility::for_modal( $post->ID );

		$this->assertSame( 'close', $a11y['focus'] );
		$this->assertSame( 'Dismiss', $a11y['closeLabel'] );
		$this->assertSame( 8, $a11y['autoClose'] );
		$this->assertSame( 1, Accessibility::overriding_count() );

		update_option( 'modal_kit_accessibility', array( 'allowAutoClose' => false ) );
		Settings::flush();
		$this->assertSame( 0, Accessibility::for_modal( $post->ID )['autoClose'] );
	}

	public function test_export_and_import() {
		$this->modal(
			array( 'modalLayout' => 'corner' ),
			array(
				'triggers' => array(
					array(
						'type'  => 'load',
						'delay' => 2,
					),
				),
			)
		);

		$request = new WP_REST_Request( 'GET', '/modal-kit/v1/export' );
		$this->assertSame( 401, rest_get_server()->dispatch( $request )->get_status() );

		wp_set_current_user( self::$admin );
		$export = rest_get_server()->dispatch( $request )->get_data();

		$this->assertSame( 'modal-kit', $export['plugin'] );
		$this->assertCount( 1, $export['modals'] );
		$this->assertSame( 2, $export['modals'][0]['meta']['triggers'][0]['delay'] );
		$this->assertArrayHasKey( 'general', $export['settings'] );

		// Same slug, no replace: skipped. With replace: updated.
		$import = new WP_REST_Request( 'POST', '/modal-kit/v1/import' );
		$import->set_body_params( array( 'data' => $export ) );
		$this->assertSame( 1, rest_get_server()->dispatch( $import )->get_data()['skipped'] );

		$import->set_body_params(
			array(
				'data'    => $export,
				'replace' => true,
			)
		);
		$this->assertSame( 1, rest_get_server()->dispatch( $import )->get_data()['updated'] );

		$export['modals'][0]['slug'] = 'brand-new';
		$import->set_body_params( array( 'data' => $export ) );
		$this->assertSame( 1, rest_get_server()->dispatch( $import )->get_data()['created'] );

		$created = get_page_by_path( 'brand-new', OBJECT, PostType::NAME );
		$this->assertSame( 2, Meta::get( $created->ID, 'triggers' )[0]['delay'] );

		$import->set_body_params( array( 'data' => array( 'plugin' => 'other' ) ) );
		$this->assertSame( 400, rest_get_server()->dispatch( $import )->get_status() );
	}

	public function test_preview_needs_a_valid_nonce_and_admin() {
		$this->assertFalse( Preview::is_request() );

		wp_set_current_user( self::$admin );
		$_GET[ Preview::ARG ] = '1';
		$_GET['_wpnonce']     = 'nope';
		$this->assertFalse( Preview::is_request() );

		$_GET['_wpnonce'] = wp_create_nonce( Preview::NONCE );
		$_GET['layout']   = 'sheet';
		$this->assertTrue( Preview::is_request() );
		$this->assertStringContainsString( '"modalLayout":"sheet"', Preview::post()->post_content );

		unset( $_GET[ Preview::ARG ], $_GET['_wpnonce'], $_GET['layout'] );
	}
}

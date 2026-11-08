<?php
/**
 * Tests for the editor's homepage backdrop ("Site preview").
 *
 * @package ModalKit
 */

use ModalKit\Backdrop;
use ModalKit\PostType;
use ModalKit\Render;

/**
 * @covers \ModalKit\Backdrop
 * @covers \ModalKit\Render
 */
class BackdropTest extends WP_UnitTestCase {

	public function tear_down() {
		unset( $_GET[ Backdrop::ARG ], $_GET['_wpnonce'] );
		parent::tear_down();
	}

	/**
	 * Signs the current request as a backdrop request.
	 *
	 * @return void
	 */
	private function request() {
		$_GET[ Backdrop::ARG ] = '1';
		$_GET['_wpnonce']      = wp_create_nonce( Backdrop::NONCE );
	}

	/**
	 * Prints the modals a page linking to "autumn-sale" needs.
	 *
	 * @return string
	 */
	private function printed() {
		self::factory()->post->create(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => 'autumn-sale',
				'post_title'   => 'Autumn sale',
				'post_content' => '<!-- wp:modal-kit/modal --><!-- wp:heading --><h2 class="wp-block-heading">Autumn sale</h2><!-- /wp:heading --><!-- /wp:modal-kit/modal -->',
			)
		);

		$render = new Render();
		$render->collect_links( '<a href="#modal-autumn-sale">Sale</a>' );

		ob_start();
		$render->print_modals();

		return (string) ob_get_clean();
	}

	public function test_only_editors_and_administrators_get_a_url() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );
		$this->assertSame( '', Backdrop::url() );

		foreach ( array( 'editor', 'administrator' ) as $role ) {
			wp_set_current_user( self::factory()->user->create( array( 'role' => $role ) ) );
			$this->assertStringContainsString( Backdrop::ARG . '=1', Backdrop::url(), $role );
			$this->assertStringStartsWith( home_url( '/' ), Backdrop::url() );
		}
	}

	public function test_the_argument_needs_the_role_and_a_nonce() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->request();
		$this->assertTrue( Backdrop::is_request() );

		$_GET['_wpnonce'] = 'nope';
		$this->assertFalse( Backdrop::is_request(), 'Bad nonce.' );

		$this->request();
		wp_set_current_user( 0 );
		$this->assertFalse( Backdrop::is_request(), 'Visitors cannot switch modals off.' );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );
		$this->request();
		$this->assertFalse( Backdrop::is_request(), 'Authors are counted like visitors.' );
	}

	public function test_backdrop_requests_print_no_modals() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$this->assertStringContainsString( '<dialog', $this->printed() );

		$this->request();
		$this->assertSame( '', $this->printed() );
	}

	public function test_modals_hidden_for_logged_in_users_are_not_printed() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$post = self::factory()->post->create(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => 'members-hidden',
				'post_content' => '<!-- wp:modal-kit/modal --><!-- wp:heading --><h2 class="wp-block-heading">Hidden</h2><!-- /wp:heading --><!-- /wp:modal-kit/modal -->',
			)
		);
		update_post_meta( $post, \ModalKit\Meta::PREFIX . 'rules', array( 'visitors' => array( 'hideLoggedIn' => true ) ) );

		$print = static function () {
			$render = new Render();
			// Linked from the page: links don't bring it back.
			$render->collect_links( '<a href="#modal-members-hidden">Open</a>' );
			ob_start();
			$render->print_modals();
			return (string) ob_get_clean();
		};

		$this->assertStringNotContainsString( 'modal-members-hidden', $print() );

		// ?modal=preview still shows it to people who can edit.
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$_GET['modal'] = 'preview';
		$preview       = $print();
		unset( $_GET['modal'] );
		$this->assertStringContainsString( 'modal-members-hidden', $preview );

		// Logged out: printed as usual.
		wp_set_current_user( 0 );
		$this->assertStringContainsString( 'modal-members-hidden', $print() );
	}

	public function test_scripts_are_not_sent() {
		// phpcs:disable WordPress.WP.EnqueuedResources -- Sample page HTML, not output.
		$html = '<head><script src="ga.js"></script><script type="importmap">{}</script></head><body><p>Hi</p><SCRIPT>track()</SCRIPT ></body>';

		$this->assertSame( '<head></head><body><p>Hi</p></body>', Backdrop::strip_scripts( $html ) );

		$preloads = '<link rel="modulepreload" href="a.js"><link rel="preload" as="script" href="b.js"><link rel="stylesheet" href="c.css">';
		$this->assertSame( '<link rel="stylesheet" href="c.css">', Backdrop::strip_scripts( $preloads ), 'Stylesheets stay.' );
		// phpcs:enable
	}

	public function test_the_capability_can_be_changed() {
		$filter = static function () {
			return 'manage_options';
		};
		add_filter( 'modal_kit_backdrop_capability', $filter );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$url = Backdrop::url();
		remove_filter( 'modal_kit_backdrop_capability', $filter );

		$this->assertSame( '', $url );
	}
}

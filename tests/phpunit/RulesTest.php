<?php
/**
 * Tests for server-side rules, settings and linked modals.
 *
 * @package ModalKit
 */

use ModalKit\Meta;
use ModalKit\PostType;
use ModalKit\Render;
use ModalKit\Rules;
use ModalKit\Settings;

/**
 * @covers \ModalKit\Rules
 * @covers \ModalKit\Settings
 * @covers \ModalKit\Render
 */
class RulesTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();
		( new Meta() )->register();
		Settings::flush();
	}

	/**
	 * Path pattern cases.
	 *
	 * @return array<string, array{0: string, 1: string, 2: bool}>
	 */
	public function paths() {
		return array(
			'home only'               => array( '/', '/', true ),
			'home is not a sub-page'  => array( '/', '/shop/', false ),
			'exact page'              => array( '/shop/', '/shop/', true ),
			'exact without slashes'   => array( 'shop', '/shop/', true ),
			'exact is not a child'    => array( '/shop/', '/shop/notebooks/', false ),
			'wildcard matches parent' => array( '/shop/*', '/shop/', true ),
			'wildcard matches child'  => array( '/shop/*', '/shop/notebooks/a5/', true ),
			'wildcard stays in tree'  => array( '/shop/*', '/shopping/', false ),
			'inner wildcard'          => array( '/journal/*/comments/', '/journal/paper/comments/', true ),
			'full URL reduced'        => array( 'https://example.org/shop/', '/shop/', true ),
			'case insensitive'        => array( '/Shop/', '/shop/', true ),
			'empty never matches'     => array( '', '/', false ),
		);
	}

	/**
	 * @dataProvider paths
	 *
	 * @param string $pattern  Pattern.
	 * @param string $path     Path.
	 * @param bool   $expected Expected.
	 */
	public function test_path_matching( $pattern, $path, $expected ) {
		$this->assertSame( $expected, Rules::path_matches( $pattern, $path ) );
	}

	public function test_targeting_modes() {
		$except = array(
			'showOn' => array(
				'mode'    => 'exclude',
				'include' => array( '/journal/' ),
				'exclude' => array( '/checkout/*' ),
			),
		);

		$this->assertTrue( Rules::targets_request( $except, '/journal/' ) );
		$this->assertTrue( Rules::targets_request( $except, '/about/' ), 'The include list is not used.' );
		$this->assertFalse( Rules::targets_request( $except, '/checkout/pay/' ) );

		// Entire site: lists kept from another choice are not used.
		$except['showOn']['mode'] = 'all';
		$this->assertTrue( Rules::targets_request( $except, '/checkout/pay/' ) );

		$include = array(
			'showOn' => array(
				'mode'    => 'include',
				'include' => array( '/shop/*', '/' ),
				'exclude' => array( '/shop/sale/' ),
			),
		);

		$this->assertTrue( Rules::targets_request( $include, '/' ) );
		$this->assertTrue( Rules::targets_request( $include, '/shop/notebooks/' ) );
		$this->assertFalse( Rules::targets_request( $include, '/shop/sale/' ), 'Exceptions count inside a listed section.' );
		$this->assertFalse( Rules::targets_request( $include, '/journal/' ) );

		// Without a section, "Only these pages" ignores exceptions.
		$pages = array(
			'showOn' => array(
				'mode'    => 'include',
				'include' => array( '/about/' ),
				'exclude' => array( '/about/' ),
			),
		);
		$this->assertFalse( Rules::exceptions_apply( $pages['showOn'] ) );
		$this->assertTrue( Rules::targets_request( $pages, '/about/' ) );
	}

	public function test_posts_picked_in_the_editor_match_by_id() {
		$about = self::factory()->post->create(
			array(
				'post_type'  => 'page',
				'post_title' => 'About',
			)
		);
		$other = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$rule  = array(
			'showOn' => array(
				'mode'    => 'include',
				'include' => array( 'post:' . $about ),
				'exclude' => array(),
			),
		);

		$this->go_to( get_permalink( $about ) );
		$this->assertTrue( Rules::targets_request( $rule ) );

		$this->go_to( get_permalink( $other ) );
		$this->assertFalse( Rules::targets_request( $rule ) );

		// Still matches after the slug changes.
		wp_update_post(
			array(
				'ID'        => $about,
				'post_name' => 'about-us',
			)
		);
		$this->go_to( get_permalink( $about ) );
		$this->assertTrue( Rules::targets_request( $rule ) );

		// "Everywhere except" a picked page.
		$all = array(
			'showOn' => array(
				'mode'    => 'exclude',
				'include' => array(),
				'exclude' => array( 'post:' . $about ),
			),
		);
		$this->assertFalse( Rules::targets_request( $all ) );
		$this->go_to( home_url( '/?s=x' ) );
		$this->assertTrue( Rules::targets_request( $all ), 'Archives and searches have no post.' );

		// The static front page is matched by its ID too.
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $about );
		$this->go_to( home_url( '/' ) );
		$this->assertTrue( Rules::targets_request( $rule ) );
	}

	public function test_post_type_targeting() {
		$post = self::factory()->post->create();
		$page = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$rule = array(
			'showOn' => array(
				'mode'      => 'include',
				'include'   => array(),
				'exclude'   => array(),
				'postTypes' => array( 'post' ),
			),
		);

		$this->go_to( get_permalink( $post ) );
		$this->assertTrue( Rules::targets_request( $rule, '/anything/' ) );

		$this->go_to( get_permalink( $page ) );
		$this->assertFalse( Rules::targets_request( $rule, '/anything/' ) );
	}

	public function test_hidden_for_logged_in_users_and_excluded_roles() {
		$rules = Meta::get( 0, 'rules' );

		$this->assertFalse( Rules::hidden_for_visitor( $rules ) );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->assertFalse( Rules::hidden_for_visitor( $rules ) );

		$rules['visitors']['hideLoggedIn'] = true;
		$this->assertTrue( Rules::hidden_for_visitor( $rules ) );

		$rules['visitors']['hideLoggedIn'] = false;
		update_option( 'modal_kit_general', array( 'hideForRoles' => array( 'editor' ) ) );
		Settings::flush();
		$this->assertTrue( Rules::hidden_for_visitor( $rules ) );
	}

	public function test_settings_fall_back_per_key() {
		$clean = Settings::sanitize(
			'general',
			array(
				'autoOpenLimit' => 3,
				'cooldown'      => -5,
				'linkPrefix'    => 'Bad Prefix!',
				'unknown'       => 'x',
			)
		);

		$this->assertSame( 3, $clean['autoOpenLimit'] );
		$this->assertSame( 20, $clean['cooldown'] );
		$this->assertSame( 'modal-', $clean['linkPrefix'] );
		$this->assertArrayNotHasKey( 'unknown', $clean );
		$this->assertTrue( $clean['linkHash'] );
	}

	public function test_settings_are_registered_for_rest() {
		$registered = get_registered_settings();

		foreach ( array( 'general', 'display', 'accessibility', 'tools', 'pro' ) as $tab ) {
			$this->assertArrayHasKey( 'modal_kit_' . $tab, $registered );
			$this->assertNotEmpty( $registered[ 'modal_kit_' . $tab ]['show_in_rest'] );
		}
	}

	public function test_links_in_content_are_collected() {
		$render = new Render();

		$render->collect_links( '<a href="#modal-autumn-sale">Sale</a> <a href="/shop/?a=1&amp;modal=field-guide">Guide</a> <a href="#other">x</a>' );

		$property = new ReflectionProperty( Render::class, 'linked' );
		// Needed before PHP 8.1; deprecated (a no-op) from 8.5.
		if ( PHP_VERSION_ID < 80100 ) {
			$property->setAccessible( true );
		}

		$this->assertSame(
			array(
				'autumn-sale' => true,
				'field-guide' => true,
			),
			$property->getValue( $render )
		);
	}

	public function test_dialog_context_carries_rules_for_the_browser() {
		$post = self::factory()->post->create_and_get(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => 'sale',
				'post_content' => '<!-- wp:modal-kit/modal {} --><!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph --><!-- /wp:modal-kit/modal -->',
			)
		);
		update_post_meta(
			$post->ID,
			Meta::PREFIX . 'rules',
			array(
				'frequency' => array(
					'mode'     => 'session',
					'maxShows' => 3,
				),
				'browsers'  => array(
					'mode' => 'except',
					'list' => array( 'in-app' ),
				),
				'visitors'  => array( 'minPageViews' => 2 ),
			)
		);

		$processor = new WP_HTML_Tag_Processor( Render::dialog( $post, false ) );
		$processor->next_tag( 'dialog' );
		$context = json_decode( $processor->get_attribute( 'data-wp-context' ), true );

		$this->assertFalse( $context['targeted'] );
		$this->assertSame( 'session', $context['rules']['frequency']['mode'] );
		$this->assertSame( 2, $context['rules']['minPageViews'] );
		$this->assertSame( 3, $context['rules']['frequency']['maxShows'] );
		$this->assertSame(
			array(
				'mode' => 'except',
				'list' => array( 'in-app' ),
			),
			$context['rules']['browsers']
		);
		$this->assertSame( 8, strlen( $context['version'] ) );
	}
}

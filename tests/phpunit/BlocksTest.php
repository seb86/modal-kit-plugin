<?php
/**
 * Tests for block registration.
 *
 * @package ModalKit
 */

use ModalKit\Blocks;

/**
 * @covers \ModalKit\Blocks
 */
class BlocksTest extends WP_UnitTestCase {

	const HANDLE = 'modal-kit-modal-style';

	/**
	 * The site's styles and block type, put back after each test.
	 *
	 * @var array{0: WP_Styles|null, 1: WP_Block_Type|null}
	 */
	private $saved;

	public function set_up() {
		parent::set_up();
		$this->saved = array(
			$GLOBALS['wp_styles'] ?? null,
			WP_Block_Type_Registry::get_instance()->get_registered( 'modal-kit/modal' ),
		);
	}

	public function tear_down() {
		$GLOBALS['wp_locale']->text_direction = 'ltr';
		$GLOBALS['wp_styles']                 = $this->saved[0];

		$registry = WP_Block_Type_Registry::get_instance();
		if ( $registry->is_registered( 'modal-kit/modal' ) ) {
			$registry->unregister( 'modal-kit/modal' );
		}
		if ( $this->saved[1] ) {
			$registry->register( $this->saved[1] );
		}

		parent::tear_down();
	}

	/**
	 * Registers the block again as on a site written in that direction.
	 *
	 * @param string $direction "ltr" or "rtl".
	 * @return void
	 */
	private function register_in( $direction ) {
		$GLOBALS['wp_locale']->text_direction = $direction;
		$GLOBALS['wp_styles']                 = null;

		if ( WP_Block_Type_Registry::get_instance()->is_registered( 'modal-kit/modal' ) ) {
			unregister_block_type( 'modal-kit/modal' );
		}

		( new Blocks() )->register();

		// As on a live site (SCRIPT_DEBUG off), whatever this test site uses.
		if ( 'rtl' === $direction ) {
			wp_style_add_data( self::HANDLE, 'suffix', '.min' );
		}
	}

	/**
	 * The stylesheet's address as it's printed.
	 *
	 * @return string
	 */
	private function printed_href() {
		ob_start();
		wp_styles()->do_item( self::HANDLE );
		$tag = (string) ob_get_clean();

		$this->assertMatchesRegularExpression( "/href='([^']+)'/", $tag );
		preg_match( "/href='([^']+)'/", $tag, $match );

		return $match[1];
	}

	public function test_a_right_to_left_site_gets_the_right_to_left_stylesheet() {
		$this->register_in( 'rtl' );

		// Without the fix, core keeps the left-to-right file on a live site.
		$this->assertStringContainsString( 'style-index.css', $this->printed_href() );

		( new Blocks() )->serve_rtl_styles();

		$this->assertStringContainsString( 'style-index-rtl.css', $this->printed_href() );
	}

	public function test_the_editor_stylesheet_too() {
		$this->register_in( 'rtl' );
		$type   = WP_Block_Type_Registry::get_instance()->get_registered( 'modal-kit/modal' );
		$handle = $type->editor_style_handles[0];
		wp_style_add_data( $handle, 'suffix', '.min' );

		( new Blocks() )->serve_rtl_styles();

		ob_start();
		wp_styles()->do_item( $handle );
		$this->assertStringContainsString( '/index-rtl.css', (string) ob_get_clean() );
	}

	public function test_a_left_to_right_site_is_left_alone() {
		$this->register_in( 'ltr' );

		( new Blocks() )->serve_rtl_styles();

		$this->assertStringContainsString( 'style-index.css', $this->printed_href() );
		$this->assertFalse( wp_styles()->get_data( self::HANDLE, 'rtl' ) );
	}
}

<?php
/**
 * Tests for front-end modal markup.
 *
 * @package ModalKit
 */

use ModalKit\PostType;
use ModalKit\Render;
use ModalKit\ThemeTokens;

/**
 * @covers \ModalKit\Render
 * @covers \ModalKit\ThemeTokens
 */
class RenderTest extends WP_UnitTestCase {

	/**
	 * Creates a modal post.
	 *
	 * @param array<string, mixed> $attributes Modal block attributes.
	 * @param string               $inner      Inner block markup.
	 * @return WP_Post
	 */
	private function modal( $attributes = array(), $inner = '' ) {
		if ( '' === $inner ) {
			$inner = '<!-- wp:heading --><h2 class="wp-block-heading">Autumn sale</h2><!-- /wp:heading --><!-- wp:paragraph --><p>20% off.</p><!-- /wp:paragraph -->';
		}

		return self::factory()->post->create_and_get(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => 'autumn-sale',
				'post_title'   => 'Autumn sale',
				'post_content' => '<!-- wp:modal-kit/modal ' . wp_json_encode( (object) $attributes ) . ' -->' . $inner . '<!-- /wp:modal-kit/modal -->',
			)
		);
	}

	public function test_dialog_has_id_classes_and_interactivity() {
		$html = Render::dialog( $this->modal( array( 'modalLayout' => 'drawer' ) ) );

		$processor = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $processor->next_tag( 'dialog' ) );
		$this->assertSame( 'modal-autumn-sale', $processor->get_attribute( 'id' ) );
		$this->assertTrue( $processor->has_class( 'modal-kit--drawer' ) );
		$this->assertTrue( $processor->has_class( 'has-overlay' ) );
		$this->assertSame( 'modal-kit', $processor->get_attribute( 'data-wp-interactive' ) );

		$context = json_decode( $processor->get_attribute( 'data-wp-context' ), true );
		$this->assertSame( 'autumn-sale', $context['slug'] );
		$this->assertTrue( $context['modal'] );
	}

	public function test_add_ons_can_change_the_modal_block_before_it_renders() {
		$filter = static function ( $block ) {
			if ( 'modal-kit/modal' === $block['blockName'] ) {
				$block['attrs']['modalLayout'] = 'corner';
			}
			return $block;
		};
		add_filter( 'render_block_data', $filter );

		$html = Render::dialog( $this->modal( array( 'modalLayout' => 'centered' ) ) );

		remove_filter( 'render_block_data', $filter );

		$processor = new WP_HTML_Tag_Processor( $html );
		$processor->next_tag( 'dialog' );
		$this->assertTrue( $processor->has_class( 'modal-kit--corner' ) );
	}

	public function test_first_heading_names_the_dialog() {
		$html = Render::dialog( $this->modal() );

		$processor = new WP_HTML_Tag_Processor( $html );
		$processor->next_tag( 'dialog' );
		$this->assertSame( 'modal-autumn-sale-title', $processor->get_attribute( 'aria-labelledby' ) );
		$this->assertTrue( $processor->next_tag( 'h2' ) );
		$this->assertSame( 'modal-autumn-sale-title', $processor->get_attribute( 'id' ) );
	}

	public function test_title_names_a_dialog_without_heading() {
		$html = Render::dialog( $this->modal( array(), '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->' ) );

		$processor = new WP_HTML_Tag_Processor( $html );
		$processor->next_tag( 'dialog' );
		$this->assertSame( 'Autumn sale', $processor->get_attribute( 'aria-label' ) );
	}

	public function test_panel_carries_block_classes_and_a_labelled_close_button() {
		$html = Render::dialog( $this->modal( array( 'className' => 'is-style-soft' ) ) );

		$processor = new WP_HTML_Tag_Processor( $html );
		$processor->next_tag( array( 'class_name' => 'modal-kit__panel' ) );
		$this->assertTrue( $processor->has_class( 'wp-block-modal-kit-modal' ) );
		$this->assertTrue( $processor->has_class( 'is-style-soft' ) );

		$processor->next_tag( array( 'class_name' => 'modal-kit__close' ) );
		$this->assertSame( 'BUTTON', $processor->get_tag() );
		$this->assertSame( 'Close', $processor->get_attribute( 'aria-label' ) );
	}

	public function test_close_button_can_be_removed() {
		$html = Render::dialog( $this->modal( array( 'closeOptions' => array( 'button' => false ) ) ) );

		$this->assertStringNotContainsString( 'modal-kit__close', $html );
	}

	public function test_full_screen_close_shows_its_label() {
		$html = Render::dialog( $this->modal( array( 'modalLayout' => 'full' ) ) );

		$this->assertStringContainsString( 'modal-kit__close has-label', $html );
		$this->assertStringContainsString( '<span class="modal-kit__close-label">Close</span>', $html );
	}

	public function test_post_without_modal_block_renders_nothing() {
		$post = self::factory()->post->create_and_get(
			array(
				'post_type'    => PostType::NAME,
				'post_content' => '<!-- wp:paragraph --><p>Stray</p><!-- /wp:paragraph -->',
			)
		);

		$this->assertSame( '', Render::dialog( $post ) );
	}

	public function test_theme_tokens_are_valid_css_values() {
		$css = ThemeTokens::css();

		$this->assertStringStartsWith( ':root{', $css );
		$this->assertStringNotContainsString( '}', substr( $css, 0, -1 ) );
		$this->assertSame( 'var(--wp--preset--color--base)', ThemeTokens::to_css( 'var:preset|color|base' ) );
		$this->assertSame( '', ThemeTokens::sanitize_css_value( 'red;}body{display:none' ) );
	}
}

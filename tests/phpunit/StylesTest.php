<?php
/**
 * Tests for the fixed styles (plan §3.6).
 *
 * @package ModalKit
 */

use ModalKit\PostType;
use ModalKit\Render;
use ModalKit\Settings;
use ModalKit\Styles;

/**
 * @covers \ModalKit\Styles
 */
class StylesTest extends WP_UnitTestCase {

	public function tear_down() {
		remove_all_filters( 'modal_kit_styles' );
		Styles::flush();
		wp_dequeue_style( Styles::FONTS_HANDLE );
		delete_option( Settings::PREFIX . 'display' );
		Settings::flush();
		parent::tear_down();
	}

	/**
	 * A style registered through the filter.
	 *
	 * @return array<string, mixed>
	 */
	private function harbour_lights() {
		return array(
			'label'  => 'Harbour lights',
			'color'  => array(
				'surface'     => '#FFFFFF',
				'ink'         => '#101010',
				'accent'      => '#0050A0',
				'on-accent'   => '#FFFFFF',
				'overlay'     => 'rgba(0,0,0,.4)',
				'full-bg'     => '#101010',
				'full-ink'    => '#FFFFFF',
				'full-accent' => '#80C0FF',
			),
			'font'   => array( 'head' => 'Georgia, serif' ),
			'radius' => array( 'panel' => '4px' ),
			'shadow' => 'none',
		);
	}

	public function test_built_in_styles_come_from_their_json_files() {
		$styles = Styles::all();

		$this->assertSame( array( 'fieldnote', 'harbor', 'night' ), array_keys( $styles ) );
		$this->assertSame( 'Harbor', $styles['harbor']['label'] );
		$this->assertTrue( $styles['harbor']['builtin'] );
		$this->assertSame( '36px', $styles['harbor']['font']['head-size'] );
	}

	public function test_each_style_is_a_block_style_of_the_modal() {
		$registered = WP_Block_Styles_Registry::get_instance()->get_registered_styles_for_block( 'modal-kit/modal' );

		// Native, Soft and Editorial are in block.json.
		foreach ( array( 'fieldnote', 'harbor', 'night' ) as $name ) {
			$this->assertArrayHasKey( $name, $registered, $name );
		}
	}

	public function test_the_filter_adds_a_style_with_its_own_rule() {
		add_filter(
			'modal_kit_styles',
			function ( $styles ) {
				$styles['harbour-lights'] = $this->harbour_lights();
				// Taken by the styles that follow the theme, and incomplete.
				$styles['soft']    = $this->harbour_lights();
				$styles['partial'] = array( 'label' => 'Partial' );

				return $styles;
			}
		);
		Styles::flush();

		$styles = Styles::all();
		$this->assertArrayHasKey( 'harbour-lights', $styles );
		$this->assertArrayNotHasKey( 'soft', $styles );
		$this->assertArrayNotHasKey( 'partial', $styles );
		$this->assertFalse( $styles['harbour-lights']['builtin'] );

		$css = Styles::css( $styles['harbour-lights'] );
		$this->assertStringStartsWith( '.mk-style-harbour-lights{', $css );
		$this->assertStringContainsString( '--mk-surface:#FFFFFF', $css );
		// The overlay's color only; the modal's Opacity setting decides.
		$this->assertStringContainsString( '--mk-overlay:rgb(0 0 0)', $css );
		$this->assertStringContainsString( '--mk-font-head:Georgia, serif', $css );
		$this->assertStringContainsString( '--mk-full-button:#FFFFFF', $css );
	}

	public function test_unsafe_values_are_dropped() {
		add_filter(
			'modal_kit_styles',
			function ( $styles ) {
				$style                    = $this->harbour_lights();
				$style['shadow']          = 'none}body{display:none';
				$style['font']['body']    = 'x;}</style><script>';
				$styles['harbour-lights'] = $style;

				return $styles;
			}
		);
		Styles::flush();

		$css = Styles::css( Styles::get( 'harbour-lights' ) );
		$this->assertStringNotContainsString( 'display:none', $css );
		$this->assertStringNotContainsString( '<', $css );
		$this->assertStringNotContainsString( '--mk-shadow', $css );
	}

	public function test_a_fixed_style_gives_the_dialog_its_classes_and_loads_the_fonts() {
		$post = self::factory()->post->create_and_get(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => 'night-sale',
				'post_content' => '<!-- wp:modal-kit/modal {"className":"is-style-night","styleOptions":{"accent":"custom","accentColor":"#5e45cd","fonts":"style"}} --><!-- wp:heading --><h2 class="wp-block-heading">Night sale</h2><!-- /wp:heading --><!-- /wp:modal-kit/modal -->',
			)
		);

		$this->assertFalse( wp_style_is( Styles::FONTS_HANDLE, 'enqueued' ) );

		$processor = new WP_HTML_Tag_Processor( Render::dialog( $post ) );
		$processor->next_tag( 'dialog' );

		$this->assertTrue( $processor->has_class( 'mk-style' ) );
		$this->assertTrue( $processor->has_class( 'mk-style-night' ) );
		$this->assertFalse( $processor->has_class( 'mk-fonts-theme' ) );
		$this->assertStringContainsString( '--mk-accent:#5e45cd', (string) $processor->get_attribute( 'style' ) );
		$this->assertStringContainsString( '--mk-on-accent:#fff', (string) $processor->get_attribute( 'style' ) );
		$this->assertTrue( wp_style_is( Styles::FONTS_HANDLE, 'enqueued' ) );
	}

	public function test_theme_fonts_and_theme_styles_leave_the_fonts_unloaded() {
		foreach ( array(
			'{"className":"is-style-harbor","styleOptions":{"fonts":"theme"}}',
			'{"className":"is-style-soft"}',
			'{}',
		) as $index => $attributes ) {
			$post = self::factory()->post->create_and_get(
				array(
					'post_type'    => PostType::NAME,
					'post_status'  => 'publish',
					'post_name'    => 'plain-' . $index,
					'post_content' => '<!-- wp:modal-kit/modal ' . $attributes . ' --><!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph --><!-- /wp:modal-kit/modal -->',
				)
			);

			Render::dialog( $post );
		}

		$this->assertFalse( wp_style_is( Styles::FONTS_HANDLE, 'enqueued' ) );
	}

	public function test_new_modals_get_the_default_style_from_settings() {
		update_option(
			Settings::PREFIX . 'display',
			array_merge(
				Settings::schema( 'display' )['default'],
				array(
					'defaultStyle'       => 'harbor',
					'defaultAccent'      => 'custom',
					'defaultAccentColor' => '#aa3300',
					'defaultFonts'       => 'theme',
				)
			)
		);
		Settings::flush();

		$attributes = PostType::template_attributes();

		$this->assertSame( 'is-style-harbor', $attributes['className'] );
		$this->assertSame(
			array(
				'accent'      => 'custom',
				'accentColor' => '#aa3300',
				'fonts'       => 'theme',
			),
			$attributes['styleOptions']
		);
	}

	public function test_an_unknown_default_style_falls_back_to_theme_native() {
		$clean = Settings::sanitize( 'display', array( 'defaultStyle' => 'Not a slug!' ) );
		$this->assertSame( 'default', $clean['defaultStyle'] );

		update_option( Settings::PREFIX . 'display', array_merge( $clean, array( 'defaultStyle' => 'removed-style' ) ) );
		Settings::flush();

		$this->assertArrayNotHasKey( 'className', PostType::template_attributes() );
	}

	public function test_text_on_an_accent_picks_the_more_readable_color() {
		$this->assertSame( '#fff', Styles::text_on( '#5E45CD' ) );
		$this->assertSame( '#17151f', Styles::text_on( '#FFCC00' ) );
		$this->assertEqualsWithDelta( 21, Styles::contrast( '#000', '#fff' ), 0.01 );
	}
}

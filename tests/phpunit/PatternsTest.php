<?php
/**
 * Tests for the starter patterns.
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

/**
 * @covers \ModalKit\Patterns
 */
class PatternsTest extends WP_UnitTestCase {

	/**
	 * Expected starters, slug => layout.
	 */
	const STARTERS = array(
		'modal-kit/monthly-letter'     => 'centered',
		'modal-kit/discount-code'      => 'split',
		'modal-kit/shipping-notice'    => 'bar',
		'modal-kit/parting-gift'       => 'full',
		'modal-kit/product-drop'       => 'corner',
		'modal-kit/event-announcement' => 'drawer',
		'modal-kit/video-tour'         => 'video',
	);

	public function test_starters_are_registered_for_modals_only() {
		$registry = WP_Block_Patterns_Registry::get_instance();

		foreach ( self::STARTERS as $slug => $layout ) {
			$this->assertTrue( $registry->is_registered( $slug ), $slug );

			$pattern = $registry->get_registered( $slug );
			$this->assertSame( array( 'mk_modal' ), $pattern['postTypes'] );
			$this->assertFalse( $pattern['inserter'] );
			$this->assertNotEmpty( array_intersect( $pattern['categories'], array_keys( Patterns::categories() ) ) );
		}
	}

	public function test_each_starter_is_one_locked_modal_block_with_its_layout() {
		$registry = WP_Block_Patterns_Registry::get_instance();

		foreach ( self::STARTERS as $slug => $layout ) {
			$blocks = array_values( array_filter( parse_blocks( $registry->get_registered( $slug )['content'] ), 'is_array' ) );
			$blocks = array_values(
				array_filter(
					$blocks,
					static function ( $block ) {
						return null !== $block['blockName'];
					}
				)
			);

			$this->assertCount( 1, $blocks, $slug );
			$this->assertSame( 'modal-kit/modal', $blocks[0]['blockName'] );
			$this->assertSame( $layout, $blocks[0]['attrs']['modalLayout'] );
			$this->assertSame(
				array(
					'move'   => true,
					'remove' => true,
				),
				$blocks[0]['attrs']['lock']
			);
		}
	}

	public function test_starters_use_no_hard_coded_colors() {
		$registry = WP_Block_Patterns_Registry::get_instance();

		foreach ( array_keys( self::STARTERS ) as $slug ) {
			$this->assertDoesNotMatchRegularExpression(
				'/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i',
				$registry->get_registered( $slug )['content'],
				$slug
			);
		}
	}

	public function test_color_roles_resolve_to_theme_slugs() {
		$palette = wp_get_global_settings( array( 'color', 'palette' ) );
		$origin  = ! empty( $palette['theme'] ) ? $palette['theme'] : ( isset( $palette['default'] ) ? $palette['default'] : array() );
		$slugs   = wp_list_pluck( $origin, 'slug' );

		if ( ! $slugs ) {
			$this->markTestSkipped( 'The test theme has no palette.' );
		}

		foreach ( array( 'base', 'contrast', 'accent', 'accent-soft' ) as $role ) {
			$this->assertContains( Patterns::color( $role ), $slugs, $role );
		}
	}

	/**
	 * The text color picked for a theme's accent.
	 *
	 * @param array<string, string> $colors Color by slug.
	 * @return string Preset slug.
	 */
	private function on_accent_for( $colors ) {
		$palette = array();

		foreach ( $colors as $slug => $color ) {
			$palette[] = array(
				'slug'  => $slug,
				'name'  => $slug,
				'color' => $color,
			);
		}

		$filter = static function ( $theme_json ) use ( $palette ) {
			return $theme_json->update_with(
				array(
					'version'  => 3,
					'settings' => array( 'color' => array( 'palette' => $palette ) ),
				)
			);
		};

		add_filter( 'wp_theme_json_data_theme', $filter );
		wp_clean_theme_json_cache();

		$slug = Patterns::color( 'on-accent' );

		remove_filter( 'wp_theme_json_data_theme', $filter );
		wp_clean_theme_json_cache();

		return $slug;
	}

	public function test_text_on_the_accent_is_the_theme_color_that_reads_best() {
		$this->assertSame(
			'contrast',
			$this->on_accent_for(
				array(
					'base'     => '#FFFFFF',
					'contrast' => '#111111',
					'accent-1' => '#FFEE58',
				)
			),
			'A pale accent: Twenty Twenty-Five.'
		);
		$this->assertSame(
			'base',
			$this->on_accent_for(
				array(
					'base'     => '#FFFFFF',
					'contrast' => '#111111',
					'accent-1' => '#503AA8',
				)
			),
			'A dark accent.'
		);
		$this->assertSame(
			'base',
			$this->on_accent_for(
				array(
					'base'     => '#111111',
					'contrast' => '#FFFFFF',
					'accent-1' => '#FFEE58',
				)
			),
			'A dark theme, where base is the dark one.'
		);
		$this->assertSame(
			'base',
			$this->on_accent_for(
				array(
					'base'     => '#FFFFFF',
					'contrast' => '#111111',
					'accent-1' => 'var(--brand)',
				)
			),
			'A color it can\'t work out.'
		);
	}

	public function test_starters_on_the_accent_use_the_text_color_for_it() {
		foreach ( array( 'discount-code', 'shipping-notice' ) as $starter ) {
			$source = (string) file_get_contents( MODAL_KIT_PATH . "patterns/{$starter}.php" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.

			$this->assertStringContainsString( "Patterns::color( 'on-accent' )", $source, $starter );
		}
	}

	public function test_markup_helpers_match_core_save_output() {
		$this->assertSame(
			"<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">Hi &amp; bye</h2>\n<!-- /wp:heading -->",
			Patterns::heading( 'Hi & bye' )
		);
		$this->assertSame(
			"<!-- wp:paragraph -->\n<p>Plain</p>\n<!-- /wp:paragraph -->",
			Patterns::paragraph( 'Plain' )
		);
		$this->assertStringContainsString(
			'<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button">No</a></div>',
			Patterns::buttons(
				array(
					array(
						'text'    => 'No',
						'outline' => true,
					),
				)
			)
		);
	}
}

<?php
/**
 * Tests for layout resolution. Shares its cases with tests/js/layouts.test.js.
 *
 * @package ModalKit
 */

use ModalKit\Layouts;

/**
 * @covers \ModalKit\Layouts
 */
class LayoutsTest extends WP_UnitTestCase {

	/**
	 * Cases from tests/fixtures/layout-cases.json.
	 *
	 * @return array<string, array<int, mixed>>
	 */
	public function cases() {
		$json  = file_get_contents( dirname( __DIR__ ) . '/fixtures/layout-cases.json' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$cases = array();

		foreach ( json_decode( $json, true ) as $case ) {
			$cases[ $case['name'] ] = array( $case['attributes'], $case['classes'], $case['style'] );
		}

		return $cases;
	}

	/**
	 * @dataProvider cases
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string[]             $classes    Expected classes.
	 * @param string               $style      Expected inline style.
	 */
	public function test_matches_the_shared_cases( $attributes, $classes, $style ) {
		$resolved = Layouts::resolve( $attributes );

		$this->assertSame( $classes, Layouts::container_classes( $resolved ) );
		$this->assertSame( $style, Layouts::container_style( $resolved ) );
	}

	public function test_full_screen_close_is_always_labelled() {
		$resolved = Layouts::resolve(
			array(
				'modalLayout'  => 'full',
				'closeOptions' => array( 'visibleLabel' => false ),
			)
		);

		$this->assertTrue( $resolved['closeOptions']['visibleLabel'] );
	}

	public function test_overlay_color_is_reduced_to_a_slug() {
		$resolved = Layouts::resolve(
			array(
				'overlay' => array(
					'show'  => true,
					'color' => 'red);background:url(x',
				),
			)
		);

		$this->assertStringNotContainsString( 'url(', Layouts::container_style( $resolved ) );
	}

	public function test_custom_overlay_colors_are_plain_color_values() {
		$this->assertSame( '#1a2b3c', Layouts::css_color( '#1a2b3c' ) );
		$this->assertSame( 'rgba(10, 20, 30, 0.5)', Layouts::css_color( 'rgba(10, 20, 30, 0.5)' ) );
		$this->assertSame( 'hsl(210deg 40% 20%)', Layouts::css_color( 'hsl(210deg 40% 20%)' ) );

		foreach ( array( 'red;background:url(x)', 'url(x)', '#12345', 'var(--x)', 'expression(1)' ) as $bad ) {
			$this->assertSame( '', Layouts::css_color( $bad ), $bad );
		}

		// A palette slug wins over a custom value.
		$resolved = Layouts::resolve(
			array(
				'overlay' => array(
					'color'       => 'contrast',
					'customColor' => '#ffffff',
				),
			)
		);
		$this->assertStringContainsString( 'preset--color--contrast', Layouts::container_style( $resolved ) );
	}

	public function test_add_ons_can_add_layouts() {
		$add = static function ( $layouts ) {
			$layouts['gate'] = array(
				'overlay'   => true,
				'modal'     => true,
				'positions' => array(),
				'mobile'    => 'full',
				'base'      => 'centered',
				'closable'  => false,
			);

			return $layouts;
		};
		add_filter( 'modal_kit_layouts', $add );

		$resolved = Layouts::resolve( array( 'modalLayout' => 'gate' ) );

		$this->assertSame( 'gate', $resolved['layout'] );
		$this->assertFalse( $resolved['closeOptions']['button'] );
		$this->assertFalse( $resolved['closeOptions']['esc'] );
		$this->assertSame(
			array( 'modal-kit', 'modal-kit--gate', 'modal-kit--centered', 'modal-kit--size-m', 'modal-kit--m-full', 'modal-kit--anim-fade-rise', 'has-overlay' ),
			Layouts::container_classes( $resolved )
		);

		remove_filter( 'modal_kit_layouts', $add );
		$this->assertSame( 'centered', Layouts::resolve( array( 'modalLayout' => 'gate' ) )['layout'] );
	}
}

<?php
/**
 * Style import, export and Your styles.
 *
 * @package ModalKit
 */

use ModalKit\PostType;
use ModalKit\StyleSchema;
use ModalKit\Styles;
use ModalKit\UserStyles;

/**
 * @covers \ModalKit\StyleSchema
 * @covers \ModalKit\UserStyles
 * @covers \ModalKit\Rest\StyleLibrary
 * @covers \ModalKit\Styles
 */
class StyleLibraryTest extends WP_UnitTestCase {

	public function set_up() {
		parent::set_up();

		rest_get_server();
		Styles::flush();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	public function tear_down() {
		delete_option( UserStyles::OPTION );
		delete_option( 'modal_kit_display' );
		Styles::flush();

		parent::tear_down();
	}

	/**
	 * A REST request.
	 *
	 * @param string               $method Method.
	 * @param string               $route  Route under modal-kit/v1.
	 * @param array<string, mixed> $params Params.
	 * @return WP_REST_Response
	 */
	private function call( $method, $route, $params = array() ) {
		$request = new WP_REST_Request( $method, '/modal-kit/v1' . $route );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		return rest_do_request( $request );
	}

	/**
	 * A style that passes the contrast test.
	 *
	 * @return array<string, mixed>
	 */
	private static function terracotta() {
		return array(
			'slug'        => 'terracotta',
			'label'       => 'Terracotta',
			'description' => 'Warm cream, rust, serif headings',
			'color'       => array(
				'surface' => '#FFFAF6',
				'ink'     => '#3B2219',
				'accent'  => '#9E3A1F',
			),
			'font'        => array( 'head' => "'Recoleta', Georgia, serif" ),
		);
	}

	public function test_the_sanitiser_lets_only_colours_and_lengths_through() {
		$this->assertSame( '#B4472B', StyleSchema::sanitize_value( 'color', '#B4472B' ) );
		$this->assertSame( '12px', StyleSchema::sanitize_value( 'length', '12px' ) );
		$this->assertSame( '36px', StyleSchema::sanitize_value( 'size', '36px' ) );
		$this->assertSame( 600, StyleSchema::sanitize_value( 'weight', 600 ) );

		foreach ( array( 'url(x.png)', 'expression(alert(1))', '#fff; color: red', '#fff}body{', 'red' ) as $bad ) {
			$this->assertNull( StyleSchema::sanitize_value( 'color', $bad ), $bad );
		}

		$this->assertNull( StyleSchema::sanitize_value( 'shadow', '0 0 4px url(x)' ) );
		$this->assertNull( StyleSchema::sanitize_value( 'family', 'Inter} .x{' ) );
	}

	public function test_import_fills_from_fieldnote_and_ignores_unknown_keys() {
		$read = StyleSchema::read( self::terracotta() + array( 'script' => 'alert(1)' ) );

		$this->assertSame( '', $read['error'] );
		$this->assertSame( '#55536A', $read['style']['color']['muted'] );
		$this->assertContains( 'shadow', $read['missing'] );
		$this->assertSame( array( 'script' ), $read['ignored'] );
		$this->assertArrayNotHasKey( 'script', $read['style'] );
	}

	public function test_built_in_styles_export_exactly_as_their_files() {
		foreach ( array( 'fieldnote', 'harbor', 'night' ) as $slug ) {
			$file = str_replace( "\r\n", "\n", (string) file_get_contents( dirname( __DIR__, 2 ) . '/src/styles/' . $slug . '.json' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents

			$this->assertSame( $file, StyleSchema::export_json( StyleSchema::read( json_decode( $file, true ) )['style'] ), $slug );
		}
	}

	public function test_importing_saves_registers_and_renders_the_style() {
		$response = $this->call( 'POST', '/styles', array( 'style' => self::terracotta() ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'terracotta', $response->get_data()['item']['slug'] );
		$this->assertSame( 'imported', $response->get_data()['item']['source'] );
		$this->assertStringContainsString( '.mk-style-terracotta{', $response->get_data()['css'] );
		// Recoleta isn't on the test site: Georgia shows instead.
		$this->assertSame(
			array(
				array(
					'font'     => 'Recoleta',
					'fallback' => 'Georgia',
				),
			),
			$response->get_data()['fonts']
		);

		$this->assertSame( 'imported', Styles::for_js()['terracotta']['source'] );
		$this->assertSame( 'terracotta', Styles::resolve( array( 'className' => 'is-style-terracotta' ) )['slug'] );
	}

	public function test_low_contrast_is_reported_not_blocked() {
		$faint                   = self::terracotta();
		$faint['color']['ink']   = '#EDE6E0';
		$faint['color']['muted'] = '#EDE6E0';

		$response = $this->call( 'POST', '/styles', array( 'style' => $faint ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertFalse( $response->get_data()['contrast']['pass'] );
		$this->assertNotEmpty( $response->get_data()['contrast']['failures'] );
		$this->assertSame( 'imported', $response->get_data()['item']['source'] );
		$this->assertSame( '#EDE6E0', Styles::get( 'terracotta' )['color']['ink'] );
	}

	public function test_a_taken_name_is_copied_or_replaced() {
		$this->call( 'POST', '/styles', array( 'style' => self::terracotta() ) );

		// The default is a copy, named Terracotta 2.
		$copy = $this->call( 'POST', '/styles', array( 'style' => self::terracotta() ) )->get_data()['item'];
		$this->assertSame( 'terracotta-2', $copy['slug'] );
		$this->assertSame( 'Terracotta 2', $copy['label'] );

		// Replace keeps the slug and takes the new tokens.
		$changed                    = self::terracotta();
		$changed['color']['accent'] = '#7A2E14';
		$replaced                   = $this->call(
			'POST',
			'/styles',
			array(
				'style' => $changed,
				'mode'  => 'replace',
			)
		)->get_data()['item'];
		$this->assertSame( 'terracotta', $replaced['slug'] );
		$this->assertSame( '#7A2E14', Styles::get( 'terracotta' )['color']['accent'] );

		// A built-in name is never replaced.
		$night = $this->call(
			'POST',
			'/styles',
			array(
				'style' => array( 'label' => 'Night' ) + array_diff_key(
					self::terracotta(),
					array(
						'label' => 1,
						'slug'  => 1,
					)
				),
				'mode'  => 'replace',
			)
		)->get_data()['item'];
		$this->assertSame( 'night-2', $night['slug'] );
	}

	public function test_duplicating_a_built_in_style() {
		$item = $this->call( 'POST', '/styles/fieldnote/duplicate', array( 'label' => 'Clinic' ) )->get_data()['item'];

		$this->assertSame( 'clinic', $item['slug'] );
		$this->assertSame( 'yours', $item['source'] );
		$this->assertSame( 'fieldnote', $item['from'] );
		$this->assertSame( Styles::get( 'fieldnote' )['color'], Styles::get( 'clinic' )['color'] );
	}

	public function test_deleting_a_style_in_use_asks_where_its_modals_go() {
		$this->call( 'POST', '/styles', array( 'style' => self::terracotta() ) );
		update_option( 'modal_kit_display', array( 'defaultStyle' => 'terracotta' ) );

		$modal = self::factory()->post->create(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:modal-kit/modal {"className":"is-style-terracotta"} --><div class="wp-block-modal-kit-modal is-style-terracotta"></div><!-- /wp:modal-kit/modal -->',
			)
		);
		// A longer slug that starts the same isn't counted.
		self::factory()->post->create(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:modal-kit/modal {"className":"is-style-terracotta-2"} /-->',
			)
		);

		$this->assertSame( array( $modal ), UserStyles::modals_using( 'terracotta' ) );
		$this->assertSame( 1, $this->call( 'GET', '/styles' )->get_data()['styles'][3]['usedBy'] ?? null );

		$this->assertSame( 409, $this->call( 'DELETE', '/styles/terracotta' )->get_status() );
		$this->assertSame( 400, $this->call( 'DELETE', '/styles/night' )->get_status() );

		$response = $this->call( 'DELETE', '/styles/terracotta', array( 'reassign' => 'harbor' ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 1, $response->get_data()['reassigned'] );
		$this->assertStringContainsString( 'is-style-harbor', get_post( $modal )->post_content );
		$this->assertStringNotContainsString( 'is-style-terracotta"', get_post( $modal )->post_content );
		$this->assertSame( 'harbor', get_option( 'modal_kit_display' )['defaultStyle'] );
		$this->assertNull( Styles::get( 'terracotta' ) );
	}

	public function test_a_style_made_here_is_yours_and_keeps_that_when_edited() {
		$made = $this->call(
			'POST',
			'/styles',
			array(
				'style'  => self::terracotta(),
				'source' => 'yours',
			)
		)->get_data()['item'];
		$this->assertSame( 'yours', $made['source'] );

		$duplicate = $this->call( 'POST', '/styles/fieldnote/duplicate', array( 'label' => 'Clinic' ) )->get_data()['item'];

		// Editing (replace) keeps the source and what it was duplicated from.
		$changed                    = Styles::get( 'clinic' );
		$changed['color']['accent'] = '#7A2E14';
		$edited                     = $this->call(
			'POST',
			'/styles',
			array(
				'style' => $changed,
				'mode'  => 'replace',
			)
		)->get_data()['item'];

		$this->assertSame( 'clinic', $edited['slug'] );
		$this->assertSame( 'yours', $edited['source'] );
		$this->assertSame( $duplicate['from'], $edited['from'] );
		$this->assertSame( '#7A2E14', Styles::get( 'clinic' )['color']['accent'] );
	}

	public function test_a_new_name_renames_the_slug_and_moves_its_modals() {
		$this->call( 'POST', '/styles', array( 'style' => self::terracotta() ) );
		update_option( 'modal_kit_display', array( 'defaultStyle' => 'terracotta' ) );

		$modal = self::factory()->post->create(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:modal-kit/modal {"className":"is-style-terracotta"} --><div class="wp-block-modal-kit-modal is-style-terracotta"></div><!-- /wp:modal-kit/modal -->',
			)
		);

		// Changing anything but the name keeps the slug.
		$same                    = Styles::get( 'terracotta' );
		$same['color']['accent'] = '#7A2E14';
		$kept                    = $this->call(
			'POST',
			'/styles',
			array(
				'style' => $same,
				'mode'  => 'replace',
			)
		)->get_data()['item'];
		$this->assertSame( 'terracotta', $kept['slug'] );

		$renamed          = Styles::get( 'terracotta' );
		$renamed['label'] = 'Rust and Cream';
		$item             = $this->call(
			'POST',
			'/styles',
			array(
				'style' => $renamed,
				'mode'  => 'replace',
			)
		)->get_data()['item'];

		$this->assertSame( 'rust-and-cream', $item['slug'] );
		$this->assertSame( 'imported', $item['source'] );
		$this->assertSame( '#7A2E14', Styles::get( 'rust-and-cream' )['color']['accent'] );
		$this->assertNull( Styles::get( 'terracotta' ) );
		$this->assertStringContainsString( '"slug": "rust-and-cream"', $item['json'] );
		$this->assertStringContainsString( 'is-style-rust-and-cream', get_post( $modal )->post_content );
		$this->assertSame( 'rust-and-cream', get_option( 'modal_kit_display' )['defaultStyle'] );

		// A name another style has gets the next free slug.
		$this->call(
			'POST',
			'/styles',
			array(
				'style' => array(
					'label' => 'Night',
				) + array_diff_key(
					self::terracotta(),
					array(
						'label' => 1,
						'slug'  => 1,
					)
				),
				'mode'  => 'copy',
			)
		);
		$clash          = Styles::get( 'rust-and-cream' );
		$clash['label'] = 'Night';
		$moved          = $this->call(
			'POST',
			'/styles',
			array(
				'style' => $clash,
				'mode'  => 'replace',
			)
		)->get_data()['item'];
		$this->assertSame( 'night-3', $moved['slug'] );
		$this->assertSame( 'Night 3', $moved['label'] );
	}

	public function test_the_style_editor_note_is_a_listing() {
		$keys = wp_list_pluck( \ModalKit\Upsell::listings( 'styles' ), 'key' );

		$this->assertSame( array( 'style-editor' ), $keys );
	}

	public function test_only_administrators_manage_styles() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->assertSame( 403, $this->call( 'GET', '/styles' )->get_status() );
		$this->assertSame( 403, $this->call( 'POST', '/styles', array( 'style' => self::terracotta() ) )->get_status() );
	}
}

<?php
/**
 * Block registration.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the blocks built into build/blocks.
 */
final class Blocks {

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'init', array( $this, 'register' ) );
		add_action( 'init', array( $this, 'serve_rtl_styles' ), 100 );
	}

	/**
	 * Makes right-to-left sites get each block's right-to-left stylesheet.
	 *
	 * For a plugin's block, core finds `style-index-rtl.css` next to the
	 * stylesheet, but records a ".min" suffix when SCRIPT_DEBUG is off, as on
	 * a live site. The swap then looks for `style-index.min.css` in the address,
	 * doesn't find it, and the left-to-right file loads. Our files have no
	 * ".min", so the suffix is cleared. Late on `init`, so blocks registered by
	 * add-ons in this namespace are covered too.
	 *
	 * @return void
	 */
	public function serve_rtl_styles() {
		if ( ! is_rtl() ) {
			return;
		}

		$styles = wp_styles();

		foreach ( \WP_Block_Type_Registry::get_instance()->get_all_registered() as $name => $type ) {
			if ( 0 !== strpos( $name, 'modal-kit/' ) ) {
				continue;
			}

			$handles = array_merge( $type->style_handles, $type->editor_style_handles, $type->view_style_handles );

			foreach ( array_unique( $handles ) as $handle ) {
				$style = $styles->registered[ $handle ] ?? null;

				if (
					$style
					&& 'replace' === ( $style->extra['rtl'] ?? '' )
					&& is_string( $style->src )
					&& false === strpos( $style->src, '.min.css' )
				) {
					$styles->add_data( $handle, 'suffix', '' );
				}
			}
		}
	}

	/**
	 * Registers each block from its built block.json.
	 *
	 * @return void
	 */
	public function register() {
		$block = Plugin::path( 'build/blocks/modal' );

		if ( file_exists( $block . '/block.json' ) ) {
			register_block_type( $block );
		}
	}
}

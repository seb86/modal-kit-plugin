<?php
/**
 * Editor assets for the modal post type.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Loads the editor bundle (pattern picker, sidebar panels) on modal screens.
 */
final class Editor {

	/**
	 * Script handle.
	 */
	const HANDLE = 'modal-kit-editor';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_everywhere' ) );
	}

	/**
	 * "Play in video lightbox" works in every block editor.
	 *
	 * @return void
	 */
	public function enqueue_everywhere() {
		$asset_file = Plugin::path( 'build/extensions/video-lightbox.asset.php' );

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script( 'modal-kit-video-lightbox', Plugin::url( 'build/extensions/video-lightbox.js' ), $asset['dependencies'], $asset['version'], true );
		wp_set_script_translations( 'modal-kit-video-lightbox', 'modal-kit', Plugin::path( 'languages' ) );
	}

	/**
	 * Enqueues the editor bundle when editing a modal.
	 *
	 * @return void
	 */
	public function enqueue() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

		if ( ! $screen || PostType::NAME !== $screen->post_type ) {
			return;
		}

		$asset_file = Plugin::path( 'build/editor/index.asset.php' );

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			self::HANDLE,
			Plugin::url( 'build/editor/index.js' ),
			$asset['dependencies'],
			$asset['version'],
			true
		);

		if ( file_exists( Plugin::path( 'build/editor/style-index.css' ) ) ) {
			wp_enqueue_style(
				self::HANDLE,
				Plugin::url( 'build/editor/style-index.css' ),
				array( 'wp-components' ),
				$asset['version']
			);
		}

		wp_set_script_translations( self::HANDLE, 'modal-kit', Plugin::path( 'languages' ) );

		wp_add_inline_script(
			self::HANDLE,
			'window.modalKitEditor = ' . wp_json_encode( self::data() ) . ';',
			'before'
		);
	}

	/**
	 * Data the editor bundle needs.
	 *
	 * @return array<string, mixed>
	 */
	public static function data() {
		return array(
			'categories'      => Patterns::categories(),
			'collections'     => Patterns::collections(),
			'collectionTypes' => Patterns::collection_types(),
			'starterSettings' => Patterns::starter_settings(),
			'proListings'     => Upsell::listings(),
			'dismissed'       => Upsell::dismissed(),
			'proUrl'          => Upsell::PRO_URL,
			'prefix'          => Render::link_prefix(),
			'breakpoint'      => (int) Settings::value( 'display', 'breakpoint' ),
			'accessibility'   => Settings::get( 'accessibility' ),
			'ruleDefaults'    => Meta::schema( 'rules' )['default'],
			'backdropUrl'     => Backdrop::url(),
			'styles'          => Styles::for_js(),
			'themePrimary'    => self::theme_primary(),
			// The style picker.
			'themeTile'       => ThemeTokens::preview(),
			'themeName'       => wp_get_theme()->get( 'Name' ),
			'fonts'           => Styles::available_fonts(),
			'canManageStyles' => current_user_can( 'manage_options' ),
			'stylesUrl'       => Admin\SettingsPage::url( 'styles' ),
		);
	}

	/**
	 * The theme's primary color, for the accent contrast warning.
	 *
	 * @return string Hex color, or ''.
	 */
	public static function theme_primary() {
		$primary = ThemeTokens::primary();

		return $primary && preg_match( '/^#[0-9a-f]{3,8}$/i', $primary['color'] ) ? $primary['color'] : '';
	}
}

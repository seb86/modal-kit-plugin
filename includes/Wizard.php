<?php
/**
 * First-run setup wizard.
 *
 * @package ModalKit
 */

namespace ModalKit;

use ModalKit\Admin\SettingsPage;

defined( 'ABSPATH' ) || exit;

/**
 * Opens once after a single activation (never on bulk or network
 * activation), writes normal settings, and creates the first modal as a
 * draft. "Exit setup" works on every step; Tools can run it again.
 */
final class Wizard {

	/**
	 * Page slug.
	 */
	const SLUG = 'modal-kit-setup';

	/**
	 * Transient set on activation.
	 */
	const TRANSIENT = 'modal_kit_wizard_redirect';

	/**
	 * Option recording that setup ran (timestamp).
	 */
	const DONE = 'modal_kit_wizard_done';

	/**
	 * Script handle.
	 */
	const HANDLE = 'modal-kit-wizard';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'admin_init', array( $this, 'maybe_redirect' ) );
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	/**
	 * Activation: ask for the wizard on the next admin page, unless the
	 * plugin was activated network-wide or setup already ran.
	 *
	 * @param bool $network_wide Network activation.
	 * @return void
	 */
	public static function activate( $network_wide = false ) {
		if ( $network_wide || get_option( self::DONE ) ) {
			return;
		}

		set_transient( self::TRANSIENT, 1, 30 );
	}

	/**
	 * Redirects to the wizard once after a single activation.
	 *
	 * @return void
	 */
	public function maybe_redirect() {
		if ( ! get_transient( self::TRANSIENT ) ) {
			return;
		}

		delete_transient( self::TRANSIENT );

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Core's bulk activation flag.
		$bulk = isset( $_GET['activate-multi'] );

		if ( $bulk || wp_doing_ajax() || is_network_admin() || ! current_user_can( 'manage_options' ) ) {
			return;
		}

		wp_safe_redirect( self::url() );
		exit;
	}

	/**
	 * Wizard URL.
	 *
	 * @return string
	 */
	public static function url() {
		return admin_url( 'admin.php?page=' . self::SLUG );
	}

	/**
	 * A page with no menu entry (attached to options.php, which is hidden).
	 *
	 * @return void
	 */
	public function menu() {
		add_submenu_page(
			'options.php',
			__( 'Modal Kit setup', 'modal-kit' ),
			__( 'Modal Kit setup', 'modal-kit' ),
			'manage_options',
			self::SLUG,
			array( $this, 'render' )
		);
	}

	/**
	 * The page shell; the app renders into it.
	 *
	 * @return void
	 */
	public function render() {
		printf(
			'<div class="wrap modal-kit-wizard-wrap"><div id="modal-kit-wizard"><p>%s</p></div></div>',
			esc_html__( 'Loading…', 'modal-kit' )
		);
	}

	/**
	 * Enqueues the app on its page.
	 *
	 * @param string $hook Admin page hook.
	 * @return void
	 */
	public function enqueue( $hook ) {
		if ( 'admin_page_' . self::SLUG !== $hook ) {
			return;
		}

		$asset_file = Plugin::path( 'build/admin/wizard.asset.php' );

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script( self::HANDLE, Plugin::url( 'build/admin/wizard.js' ), $asset['dependencies'], $asset['version'], true );
		wp_enqueue_style( self::HANDLE, Plugin::url( 'build/admin/style-wizard.css' ), array( 'wp-components', Styles::FONTS_HANDLE ), $asset['version'] );
		wp_set_script_translations( self::HANDLE, 'modal-kit', Plugin::path( 'languages' ) );
		wp_add_inline_script( self::HANDLE, 'window.modalKitWizard = ' . wp_json_encode( self::data() ) . ';', 'before' );
	}

	/**
	 * What the app needs: the detected theme, WooCommerce, current settings
	 * and where to go afterwards.
	 *
	 * @return array<string, mixed>
	 */
	public static function data() {
		$theme = wp_get_theme();

		return array(
			'theme'       => array(
				'name'  => $theme->get( 'Name' ),
				'block' => wp_is_block_theme(),
			),
			'woocommerce' => class_exists( 'WooCommerce' ),
			'settings'    => array(
				'general'       => Settings::get( 'general' ),
				'display'       => Settings::get( 'display' ),
				'accessibility' => Settings::get( 'accessibility' ),
			),
			'listUrl'     => admin_url( 'edit.php?post_type=' . PostType::NAME ),
			'newUrl'      => admin_url( 'post-new.php?post_type=' . PostType::NAME ),
			'settingsUrl' => SettingsPage::url(),
			'proUrl'      => Upsell::PRO_URL,
			'showProTips' => Upsell::show_tips(),
			'colors'      => self::colors(),
			'styles'      => Styles::for_js(),
		);
	}

	/**
	 * The theme's colors for the starter previews: its button colors,
	 * background and text, resolved from global styles and the palette.
	 *
	 * @return array<string, string>
	 */
	public static function colors() {
		$palette = wp_get_global_settings( array( 'color', 'palette' ) );
		$colors  = array();

		foreach ( array( 'default', 'theme', 'custom' ) as $origin ) {
			foreach ( (array) ( $palette[ $origin ] ?? array() ) as $color ) {
				if ( isset( $color['slug'], $color['color'] ) ) {
					$colors[ (string) $color['slug'] ] = (string) $color['color'];
				}
			}
		}

		$resolve = static function ( $value, $fallback ) use ( $colors ) {
			$value = is_string( $value ) ? $value : '';

			// var:preset|color|slug or var(--wp--preset--color--slug).
			if ( preg_match( '/(?:var:preset\|color\||--wp--preset--color--)([a-z0-9-]+)/', $value, $match ) ) {
				return $colors[ $match[1] ] ?? $fallback;
			}

			return preg_match( '/^#[0-9a-f]{3,8}$/i', $value ) ? $value : $fallback;
		};

		$base     = $resolve( wp_get_global_styles( array( 'color', 'background' ) ), $colors['base'] ?? '#ffffff' );
		$contrast = $resolve( wp_get_global_styles( array( 'color', 'text' ) ), $colors['contrast'] ?? '#1e1e1e' );

		return array(
			'base'       => $base,
			'contrast'   => $contrast,
			'button'     => $resolve( wp_get_global_styles( array( 'elements', 'button', 'color', 'background' ) ), $contrast ),
			'buttonText' => $resolve( wp_get_global_styles( array( 'elements', 'button', 'color', 'text' ) ), $base ),
		);
	}

	/**
	 * POST /modal-kit/v1/setup: marks setup as done (on finish or exit).
	 *
	 * @return void
	 */
	public function routes() {
		register_rest_route(
			'modal-kit/v1',
			'/setup',
			array(
				'methods'             => 'POST',
				'callback'            => static function () {
					update_option( self::DONE, time(), false );

					return array( 'done' => true );
				},
				'permission_callback' => static function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	}
}

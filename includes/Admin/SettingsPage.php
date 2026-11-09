<?php
/**
 * The Settings screen.
 *
 * @package ModalKit
 */

namespace ModalKit\Admin;

use ModalKit\Accessibility;
use ModalKit\Editor;
use ModalKit\Admin\ModalList;
use ModalKit\Plugin;
use ModalKit\PostType;
use ModalKit\Preview;
use ModalKit\Styles;
use ModalKit\ThemeTokens;
use ModalKit\Upsell;
use ModalKit\Wizard;

defined( 'ABSPATH' ) || exit;

/**
 * A single admin page under the Modal Kit menu. The React app reads and
 * writes the settings through core-data (/wp/v2/settings).
 */
final class SettingsPage {

	/**
	 * Page slug.
	 */
	const SLUG = 'modal-kit-settings';

	/**
	 * Script handle.
	 */
	const HANDLE = 'modal-kit-settings';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( MODAL_KIT_FILE ), array( $this, 'plugin_links' ) );
	}

	/**
	 * URL of the settings page, optionally on a tab.
	 *
	 * @param string $tab Tab (general, display, accessibility, tools, pro).
	 * @return string
	 */
	public static function url( $tab = '' ) {
		$url = admin_url( 'edit.php?post_type=' . PostType::NAME . '&page=' . self::SLUG );

		return $tab ? $url . '#' . $tab : $url;
	}

	/**
	 * Adds Settings under the Modal Kit menu.
	 *
	 * @return void
	 */
	public function menu() {
		add_submenu_page(
			'edit.php?post_type=' . PostType::NAME,
			__( 'Modal Kit Settings', 'modal-kit' ),
			__( 'Settings', 'modal-kit' ),
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
			'<div class="wrap modal-kit-settings"><h1>%1$s</h1><div id="modal-kit-settings"><p>%2$s</p></div></div>',
			esc_html__( 'Settings', 'modal-kit' ),
			esc_html__( 'Loading…', 'modal-kit' )
		);
	}

	/**
	 * Settings row link on the Plugins screen ("Go Pro" is added in Upsell).
	 *
	 * @param array<string, string> $links Links.
	 * @return array<string, string>
	 */
	public function plugin_links( $links ) {
		return array_merge(
			array( 'settings' => '<a href="' . esc_url( self::url() ) . '">' . esc_html__( 'Settings', 'modal-kit' ) . '</a>' ),
			$links
		);
	}

	/**
	 * Enqueues the app on its page.
	 *
	 * @param string $hook Admin page hook.
	 * @return void
	 */
	public function enqueue( $hook ) {
		if ( PostType::NAME . '_page_' . self::SLUG !== $hook ) {
			return;
		}

		$asset_file = Plugin::path( 'build/admin/settings.asset.php' );

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script( self::HANDLE, Plugin::url( 'build/admin/settings.js' ), $asset['dependencies'], $asset['version'], true );
		wp_enqueue_style( self::HANDLE, Plugin::url( 'build/admin/style-settings.css' ), array( 'wp-components' ), $asset['version'] );
		wp_set_script_translations( self::HANDLE, 'modal-kit', Plugin::path( 'languages' ) );
		wp_add_inline_script( self::HANDLE, 'window.modalKitSettings = ' . wp_json_encode( self::data() ) . ';', 'before' );
	}

	/**
	 * What the app needs besides the settings themselves.
	 *
	 * @return array<string, mixed>
	 */
	public static function data() {
		$counts = wp_count_posts( PostType::NAME );
		$theme  = wp_get_theme();
		$roles  = array();

		foreach ( wp_roles()->get_names() as $slug => $name ) {
			$roles[] = array(
				'slug' => $slug,
				'name' => translate_user_role( $name ),
			);
		}

		$palette = wp_get_global_settings( array( 'color', 'palette' ) );
		$colors  = array();

		foreach ( array( 'theme', 'default' ) as $origin ) {
			if ( ! empty( $palette[ $origin ] ) ) {
				$colors = array_values( $palette[ $origin ] );
				break;
			}
		}

		return array(
			'site'         => array(
				'modals'     => (int) $counts->publish + (int) $counts->draft + (int) $counts->future + (int) $counts->private,
				'active'     => count( ModalList::ids_for_view( 'active' ) ),
				'theme'      => $theme->get( 'Name' ),
				'blockTheme' => wp_is_block_theme(),
				'home'       => home_url( '/' ),
			),
			'roles'        => $roles,
			'palette'      => $colors,
			'overriding'   => Accessibility::overriding_count(),
			'previewUrl'   => Preview::url(),
			'proUrl'       => Upsell::PRO_URL,
			// Settings → Styles: the Style editor note (Pro removes it).
			'proListings'  => Upsell::listings( 'styles' ),
			'dismissed'    => Upsell::dismissed(),
			// What a style preview loads (the Pro Style editor).
			'previewCss'   => array(
				Plugin::url( 'build/blocks/modal/style-index.css' ),
				Plugin::url( 'assets/fonts/fonts.css' ),
			),
			'accountUrl'   => 'https://github.com/seb86/modal-kit-plugin',
			'isProActive'  => defined( 'MODAL_KIT_PRO_VERSION' ),
			'wizardUrl'    => Wizard::url(),
			'styles'       => Styles::for_js(),
			'themeTile'    => ThemeTokens::preview(),
			'themeName'    => wp_get_theme()->get( 'Name' ),
			'fonts'        => Styles::available_fonts(),
			'exportUrl'    => wp_nonce_url( admin_url( 'admin-post.php?action=' . \ModalKit\Rest\StyleLibrary::EXPORT_ACTION ), \ModalKit\Rest\StyleLibrary::EXPORT_ACTION ),
			'themePrimary' => Editor::theme_primary(),
		);
	}
}

<?php
/**
 * Plugin bootstrap.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Wires up every part of the plugin.
 */
final class Plugin {

	/**
	 * Single instance.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Whether boot() already ran.
	 *
	 * @var bool
	 */
	private $booted = false;

	/**
	 * Returns the single instance.
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function boot() {
		if ( $this->booted ) {
			return;
		}

		$this->booted = true;

		( new Settings() )->register_hooks();
		( new Storage() )->register_hooks();
		( new PostType() )->register_hooks();
		( new Hardening() )->register_hooks();
		( new Meta() )->register_hooks();
		( new Blocks() )->register_hooks();
		( new ThemeTokens() )->register_hooks();
		( new UserStyles() )->register_hooks();
		( new Styles() )->register_hooks();
		( new Patterns() )->register_hooks();
		( new Editor() )->register_hooks();
		( new ButtonActions() )->register_hooks();
		( new Upsell() )->register_hooks();
		( new Wizard() )->register_hooks();
		( new Integrations\SimplyStatic() )->register_hooks();
		( new Integrations\SpeedOptimizer() )->register_hooks();

		add_filter( 'wp_rest_search_handlers', array( Rest\Search::class, 'register' ) );

		( new Rest\Tools() )->register_hooks();
		( new Rest\StyleLibrary() )->register_hooks();

		if ( is_admin() ) {
			( new Admin\ModalList() )->register_hooks();
			( new Admin\SettingsPage() )->register_hooks();
		} else {
			( new Render() )->register_hooks();
			( new VideoLinks() )->register_hooks();
			( new Backdrop() )->register_hooks();
		}
	}

	/**
	 * Absolute path to a file inside the plugin.
	 *
	 * @param string $relative Path relative to the plugin root.
	 * @return string
	 */
	public static function path( $relative = '' ) {
		return MODAL_KIT_PATH . ltrim( $relative, '/' );
	}

	/**
	 * URL of a file inside the plugin.
	 *
	 * @param string $relative Path relative to the plugin root.
	 * @return string
	 */
	public static function url( $relative = '' ) {
		return MODAL_KIT_URL . ltrim( $relative, '/' );
	}
}

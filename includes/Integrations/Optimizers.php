<?php
/**
 * Speed and cache plugins, including the ones hosts install.
 *
 * @package ModalKit
 */

namespace ModalKit\Integrations;

use ModalKit\Plugin;
use ModalKit\Render;

defined( 'ABSPATH' ) || exit;

/**
 * Keeps page optimisers from breaking modals, with no setting needed. Each
 * hook does nothing when its plugin isn't active.
 *
 * Scripts: the runtime is a script module that imports core's
 * `@wordpress/interactivity` through the import map.
 * - SiteGround Speed Optimizer's "Combine JavaScript files" folds modules
 *   into one classic script. Core's own are on its list; ours are added.
 * - W3 Total Cache and Breeze move asset URLs to their CDN, core's script
 *   modules included. Browsers fetch modules with CORS, and a CDN that
 *   doesn't allow it blocks them, so modules stay on the site.
 * - 10Web Booster's "delay all JavaScript" reloads scripts from blob URLs,
 *   where imports can't resolve. NitroPack delays scripts in its cloud.
 *   Both leave alone the tags that carry their opt-out attribute.
 *
 * Styles load as they are, so a modal never opens unstyled:
 * - LiteSpeed Cache works out unique and critical CSS from the page with
 *   every modal closed; its excludes keep our styles whole. Its "remove
 *   query strings" would keep serving last version's stylesheet.
 * - Jetpack Boost loads stylesheets after its critical CSS, so a modal that
 *   opens on load could show unstyled, and combining ours with others' would
 *   bring them back under that.
 */
final class Optimizers {

	/**
	 * Prefix of every style handle and tag id the plugins print.
	 */
	const PREFIX = 'modal-kit-';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_filter( 'sgo_javascript_combine_excluded_internal_paths', array( __CLASS__, 'add_paths' ) );
		add_filter( 'breeze_cdn_exclude_paths', array( __CLASS__, 'add_module_paths' ) );
		add_filter( 'w3tc_cdn_url', array( __CLASS__, 'keep_on_site' ), 10, 2 );
		add_filter( 'w3tc_minify_html_script_minifier', array( __CLASS__, 'skip_data' ), 10, 2 );
		add_filter( 'litespeed_optimize_css_excludes', array( __CLASS__, 'exclude_styles' ) );
		add_filter( 'style_loader_src', array( __CLASS__, 'keep_version' ), 10, 2 );
		add_filter( 'jetpack_boost_async_style', array( __CLASS__, 'load_style' ), 10, 2 );
		add_filter( 'css_do_concat', array( __CLASS__, 'concat_style' ), 10, 2 );
		add_filter( 'style_loader_tag', array( __CLASS__, 'tag_style' ), 10, 2 );
		add_filter( 'wp_script_attributes', array( __CLASS__, 'tag_script' ) );
		add_filter( 'wp_inline_script_attributes', array( __CLASS__, 'tag_inline_script' ) );
	}

	/**
	 * URL paths of the plugins' folders, each ending in a slash.
	 *
	 * @return array<int, string>
	 */
	public static function paths() {
		/**
		 * Filters the folders that page optimisers must leave alone: not
		 * combined, delayed or moved to a CDN. Add-ons with their own script
		 * modules add their folder.
		 *
		 * @param array<int, string> $paths URL paths, such as /wp-content/plugins/modal-kit/.
		 */
		$paths = apply_filters( 'modal_kit_optimizer_paths', array( (string) wp_parse_url( Plugin::url( '' ), PHP_URL_PATH ) ) );

		return array_values( array_filter( array_map( 'strval', (array) $paths ) ) );
	}

	/**
	 * The plugins' folders and core's script modules, which they import.
	 *
	 * @return array<int, string>
	 */
	public static function module_paths() {
		$paths   = self::paths();
		$paths[] = (string) wp_parse_url( includes_url( 'js/dist/script-modules/' ), PHP_URL_PATH );

		return $paths;
	}

	/**
	 * Adds the plugins' folders to a list (SiteGround: scripts not combined).
	 *
	 * @param mixed $paths Paths matched against each script's URL.
	 * @return array<int, string>
	 */
	public static function add_paths( $paths ) {
		return array_merge( is_array( $paths ) ? $paths : array(), self::paths() );
	}

	/**
	 * Adds the folders of every module a modal needs (Breeze: URLs its CDN
	 * leaves alone).
	 *
	 * @param mixed $paths Strings matched against each URL.
	 * @return array<int, string>
	 */
	public static function add_module_paths( $paths ) {
		return array_merge( is_array( $paths ) ? $paths : array(), self::module_paths() );
	}

	/**
	 * Keeps the modules a modal needs off W3 Total Cache's CDN.
	 *
	 * @param mixed $cdn_url The CDN address.
	 * @param mixed $url     The site's own address.
	 * @return mixed
	 */
	public static function keep_on_site( $cdn_url, $url ) {
		return is_string( $url ) && self::has_path( $url, self::module_paths() ) ? $url : $cdn_url;
	}

	/**
	 * Tells W3 Total Cache's inline minifier to leave the import map and
	 * JSON data alone: they aren't JavaScript.
	 *
	 * @param mixed $minifier Minifier.
	 * @param mixed $type     The script's type attribute, lowercased.
	 * @return mixed
	 */
	public static function skip_data( $minifier, $type ) {
		return in_array( $type, array( 'importmap', 'application/json' ), true ) ? '' : $minifier;
	}

	/**
	 * Keeps the plugins' stylesheets and inline styles out of LiteSpeed's
	 * combined, unique and critical CSS. Each entry is matched against the
	 * whole tag.
	 *
	 * @param mixed $excludes Excludes.
	 * @return array<int, string>
	 */
	public static function exclude_styles( $excludes ) {
		return array_merge(
			is_array( $excludes ) ? $excludes : array(),
			self::paths(),
			array( "id='" . self::PREFIX, 'id="' . self::PREFIX )
		);
	}

	/**
	 * Keeps the version on the plugins' stylesheets when LiteSpeed removes
	 * query strings, so an update reaches visitors' browsers.
	 *
	 * @param mixed $src    Stylesheet address.
	 * @param mixed $handle Style handle.
	 * @return mixed
	 */
	public static function keep_version( $src, $handle ) {
		if ( ! defined( 'LSCWP_V' ) || ! is_string( $src ) || ! self::is_ours( $handle ) || false === strpos( $src, 'ver=' ) ) {
			return $src;
		}

		return add_query_arg( '_litespeed_rm_qs', '0', $src );
	}

	/**
	 * Loads the plugins' stylesheets normally under Jetpack Boost's critical
	 * CSS.
	 *
	 * @param mixed $method How the stylesheet loads.
	 * @param mixed $handle Style handle.
	 * @return mixed
	 */
	public static function load_style( $method, $handle ) {
		return self::is_ours( $handle ) ? false : $method;
	}

	/**
	 * Keeps the plugins' stylesheets out of Jetpack Boost's combined CSS.
	 *
	 * @param mixed $concat Whether to combine it.
	 * @param mixed $handle Style handle.
	 * @return mixed
	 */
	public static function concat_style( $concat, $handle ) {
		return self::is_ours( $handle ) ? false : $concat;
	}

	/**
	 * Adds 10Web Booster's opt-out to the plugins' stylesheets.
	 *
	 * @param mixed $tag    The <link> tag.
	 * @param mixed $handle Style handle.
	 * @return mixed
	 */
	public static function tag_style( $tag, $handle ) {
		if ( ! defined( 'TENWEB_SO_VERSION' ) || ! is_string( $tag ) || ! self::is_ours( $handle ) || false !== strpos( $tag, 'data-noptimize' ) ) {
			return $tag;
		}

		return (string) preg_replace( '/^<link\b/i', '<link data-noptimize="1"', $tag, 1 );
	}

	/**
	 * On pages with modals, adds the delay opt-outs to the script modules
	 * they need.
	 *
	 * @param mixed $attributes Script tag attributes.
	 * @return mixed
	 */
	public static function tag_script( $attributes ) {
		if (
			! is_array( $attributes )
			|| 'module' !== ( $attributes['type'] ?? '' )
			|| ! is_string( $attributes['src'] ?? null )
			|| ! self::has_path( $attributes['src'], self::module_paths() )
		) {
			return $attributes;
		}

		return self::opt_out( $attributes );
	}

	/**
	 * On pages with modals, adds the delay opt-outs to the import map, which
	 * tells the browser where the modules are.
	 *
	 * @param mixed $attributes Inline script tag attributes.
	 * @return mixed
	 */
	public static function tag_inline_script( $attributes ) {
		return is_array( $attributes ) && 'wp-importmap' === ( $attributes['id'] ?? '' ) ? self::opt_out( $attributes ) : $attributes;
	}

	/**
	 * Adds the opt-out attributes of the active delay plugins, on pages with
	 * modals.
	 *
	 * @param array<string, mixed> $attributes Tag attributes.
	 * @return array<string, mixed>
	 */
	private static function opt_out( array $attributes ) {
		if ( ! Render::on_page() ) {
			return $attributes;
		}

		if ( defined( 'TENWEB_SO_VERSION' ) ) {
			$attributes['data-two-no-delay'] = true;
		}

		if ( defined( 'NITROPACK_VERSION' ) ) {
			$attributes['nitro-exclude'] = true;
		}

		return $attributes;
	}

	/**
	 * Whether a style handle is one of the plugins'.
	 *
	 * @param mixed $handle Handle.
	 * @return bool
	 */
	private static function is_ours( $handle ) {
		return is_string( $handle ) && 0 === strpos( $handle, self::PREFIX );
	}

	/**
	 * Whether a URL's path starts with one of the paths.
	 *
	 * @param string             $url   URL, absolute or relative to the site.
	 * @param array<int, string> $paths URL paths.
	 * @return bool
	 */
	private static function has_path( $url, array $paths ) {
		$path = (string) wp_parse_url( $url, PHP_URL_PATH );

		foreach ( $paths as $prefix ) {
			if ( '' !== $prefix && 0 === strpos( $path, $prefix ) ) {
				return true;
			}
		}

		return false;
	}
}

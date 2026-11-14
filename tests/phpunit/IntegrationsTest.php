<?php
/**
 * Tests for the integrations with other plugins.
 *
 * @package ModalKit
 */

use ModalKit\Integrations\Optimizers;
use ModalKit\Render;

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Other plugins' hooks.
// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Other plugins' constants, defined to fake them.
// phpcs:disable WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet -- Tags as strings, to check what optimisers match.

/**
 * @covers \ModalKit\Integrations\Optimizers
 */
class IntegrationsTest extends WP_UnitTestCase {

	/**
	 * The plugin's folder, as a URL path.
	 *
	 * @return string
	 */
	private function folder() {
		return (string) wp_parse_url( MODAL_KIT_URL, PHP_URL_PATH );
	}

	/**
	 * Core's script modules folder, as a URL path.
	 *
	 * @return string
	 */
	private function core_modules() {
		return (string) wp_parse_url( includes_url( 'js/dist/script-modules/' ), PHP_URL_PATH );
	}

	/**
	 * Marks the page as printing modals, as rendering one does.
	 *
	 * @param bool $on_page Whether it does.
	 * @return void
	 */
	private function modals_on_page( $on_page ) {
		$property = new ReflectionProperty( Render::class, 'on_page' );
		$property->setAccessible( true );
		$property->setValue( null, $on_page );
	}

	/**
	 * Add-ons add their folders to one list, used by every optimiser.
	 */
	public function test_add_ons_add_their_folders() {
		add_filter(
			'modal_kit_optimizer_paths',
			static function ( $paths ) {
				$paths[] = '/wp-content/plugins/an-add-on/';
				return $paths;
			}
		);

		$this->assertSame( array( $this->folder(), '/wp-content/plugins/an-add-on/' ), Optimizers::paths() );
		$this->assertStringEndsWith( '/modal-kit/', $this->folder() );
	}

	/**
	 * SiteGround Speed Optimizer's combine JavaScript leaves the plugin's
	 * script modules alone, and keeps the paths others added.
	 */
	public function test_speed_optimizer_does_not_combine_the_runtime() {
		$paths = apply_filters( 'sgo_javascript_combine_excluded_internal_paths', array( '/elsewhere/' ) );

		$this->assertContains( '/elsewhere/', $paths );
		$this->assertContains( $this->folder(), $paths );
	}

	/**
	 * Breeze's CDN leaves the plugin's modules and core's alone: browsers
	 * fetch modules with CORS.
	 */
	public function test_breeze_keeps_modules_on_the_site() {
		$paths = apply_filters( 'breeze_cdn_exclude_paths', array( 'download_file' ) );

		$this->assertContains( 'download_file', $paths );
		$this->assertContains( $this->folder(), $paths );
		$this->assertContains( $this->core_modules(), $paths );
	}

	/**
	 * W3 Total Cache's CDN keeps the modules a modal needs on the site, and
	 * moves everything else.
	 */
	public function test_w3_total_cache_keeps_modules_on_the_site() {
		$cdn = static function ( $url ) {
			return apply_filters( 'w3tc_cdn_url', 'https://cdn.example/x', $url, true );
		};

		$ours = MODAL_KIT_URL . 'build/blocks/modal/view.js';
		$core = includes_url( 'js/dist/script-modules/interactivity/index.min.js' );

		$this->assertSame( $ours, $cdn( $ours ) );
		$this->assertSame( $core, $cdn( $core ) );
		$this->assertSame( 'https://cdn.example/x', $cdn( includes_url( 'js/jquery/jquery.min.js' ) ) );
		$this->assertSame( 'https://cdn.example/x', $cdn( content_url( 'plugins/modal-kit-lookalike/a.js' ) ) );
	}

	/**
	 * W3 Total Cache's inline minifier leaves the import map and JSON data
	 * alone.
	 */
	public function test_w3_total_cache_does_not_minify_data() {
		$minifier = array( 'Minify_JS', 'minify' );

		$this->assertSame( '', apply_filters( 'w3tc_minify_html_script_minifier', $minifier, 'importmap', '' ) );
		$this->assertSame( '', apply_filters( 'w3tc_minify_html_script_minifier', $minifier, 'application/json', '' ) );
		$this->assertSame( $minifier, apply_filters( 'w3tc_minify_html_script_minifier', $minifier, 'text/javascript', '' ) );
	}

	/**
	 * LiteSpeed Cache leaves the plugins' stylesheets and inline styles out
	 * of its combined, unique and critical CSS.
	 */
	public function test_litespeed_keeps_the_styles_whole() {
		$excludes = apply_filters( 'litespeed_optimize_css_excludes', array( 'theirs.css' ) );

		$this->assertContains( 'theirs.css', $excludes );
		$this->assertContains( $this->folder(), $excludes );

		// LiteSpeed matches each entry against the whole tag.
		$hit = static function ( $tag ) use ( $excludes ) {
			foreach ( $excludes as $exclude ) {
				if ( false !== strpos( $tag, $exclude ) ) {
					return true;
				}
			}
			return false;
		};

		$this->assertTrue( $hit( "<style id='modal-kit-modal-style-inline-css'>" ) );
		$this->assertTrue( $hit( '<style id="modal-kit-pro-teaser-inline-css">' ) );
		$this->assertTrue( $hit( "<link rel='stylesheet' href='" . MODAL_KIT_URL . "build/fonts.css'>" ) );
		$this->assertFalse( $hit( "<style id='wp-block-heading-inline-css'>" ) );
	}

	/**
	 * Jetpack Boost loads the plugins' stylesheets normally and doesn't
	 * combine them.
	 */
	public function test_jetpack_boost_loads_the_styles_normally() {
		$this->assertFalse( apply_filters( 'jetpack_boost_async_style', 'async', 'modal-kit-modal-style', 'all' ) );
		$this->assertSame( 'async', apply_filters( 'jetpack_boost_async_style', 'async', 'wp-block-library', 'all' ) );
		$this->assertFalse( apply_filters( 'css_do_concat', true, 'modal-kit-fonts' ) );
		$this->assertTrue( apply_filters( 'css_do_concat', true, 'wp-block-library' ) );
	}

	/**
	 * Without LiteSpeed, 10Web Booster or NitroPack, tags are unchanged.
	 */
	public function test_tags_are_unchanged_without_those_plugins() {
		$this->modals_on_page( true );
		$src = MODAL_KIT_URL . 'build/style.css?ver=1.0.0';

		$this->assertSame( $src, apply_filters( 'style_loader_src', $src, 'modal-kit-modal-style' ) );
		$this->assertStringNotContainsString(
			'data-two-no-delay',
			wp_get_script_tag(
				array(
					'type' => 'module',
					'src'  => MODAL_KIT_URL . 'build/view.js',
				)
			)
		);
		$this->assertStringNotContainsString(
			'nitro-exclude',
			wp_get_inline_script_tag(
				'{}',
				array(
					'type' => 'importmap',
					'id'   => 'wp-importmap',
				)
			)
		);

		$this->modals_on_page( false );
	}

	/**
	 * With LiteSpeed's "remove query strings", the plugins' stylesheets keep
	 * their version.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_litespeed_keeps_the_version() {
		define( 'LSCWP_V', '7.9.3' );
		$src = MODAL_KIT_URL . 'build/style.css?ver=1.0.0';

		$this->assertStringContainsString( '_litespeed_rm_qs=0', apply_filters( 'style_loader_src', $src, 'modal-kit-modal-style' ) );
		$this->assertStringContainsString( 'ver=1.0.0', apply_filters( 'style_loader_src', $src, 'modal-kit-modal-style' ) );
		$this->assertSame( 'https://example.org/theirs.css?ver=2', apply_filters( 'style_loader_src', 'https://example.org/theirs.css?ver=2', 'theirs' ) );
		$this->assertSame( MODAL_KIT_URL . 'build/style.css', apply_filters( 'style_loader_src', MODAL_KIT_URL . 'build/style.css', 'modal-kit-modal-style' ) );
	}

	/**
	 * 10Web Booster and NitroPack don't delay the modules a modal needs, or
	 * the import map, on pages with modals; 10Web leaves the stylesheets alone.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_delay_plugins_leave_the_modules_alone() {
		define( 'TENWEB_SO_VERSION', '2.34.11' );
		define( 'NITROPACK_VERSION', '1.20.4' );

		$ours   = array(
			'type' => 'module',
			'src'  => MODAL_KIT_URL . 'build/blocks/modal/view.js?ver=1',
			'id'   => 'modal-kit-modal-view-script-module-js-module',
		);
		$core   = array(
			'type' => 'module',
			'src'  => includes_url( 'js/dist/script-modules/interactivity/index.min.js' ),
		);
		$theirs = array(
			'type' => 'module',
			'src'  => content_url( 'plugins/other/view.js' ),
		);
		$map    = array(
			'type' => 'importmap',
			'id'   => 'wp-importmap',
		);

		// Not before the page has modals.
		$this->assertStringNotContainsString( 'data-two-no-delay', wp_get_script_tag( $ours ) );
		$this->assertStringNotContainsString( 'nitro-exclude', wp_get_inline_script_tag( '{}', $map ) );

		$this->modals_on_page( true );

		foreach ( array( wp_get_script_tag( $ours ), wp_get_script_tag( $core ), wp_get_inline_script_tag( '{}', $map ) ) as $tag ) {
			$this->assertStringContainsString( ' data-two-no-delay', $tag );
			$this->assertStringContainsString( ' nitro-exclude', $tag );
		}

		$this->assertStringNotContainsString( 'data-two-no-delay', wp_get_script_tag( $theirs ) );
		$this->assertStringNotContainsString( 'data-two-no-delay', wp_get_script_tag( array( 'src' => MODAL_KIT_URL . 'classic.js' ) ) );
		$this->assertStringNotContainsString( 'data-two-no-delay', wp_get_inline_script_tag( 'x()', array( 'id' => 'other' ) ) );

		$link = "<link rel='stylesheet' id='modal-kit-modal-style-css' href='x.css' />\n";
		$this->assertStringStartsWith( '<link data-noptimize="1" rel=', apply_filters( 'style_loader_tag', $link, 'modal-kit-modal-style' ) );
		$this->assertSame( $link, apply_filters( 'style_loader_tag', $link, 'theirs' ) );
	}
}

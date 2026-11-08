<?php
/**
 * Native design tokens.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Reads the active theme's global styles and settings and exposes them as
 * --modal-kit-* custom properties, so the default (Native) style
 * follows the theme without knowing its preset slugs.
 */
final class ThemeTokens {

	/**
	 * Handle of the Modal block's shared stylesheet.
	 */
	const STYLE_HANDLE = 'modal-kit-modal-style';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		// After block registration (init, 10) so the style handle exists.
		add_action( 'init', array( $this, 'attach' ), 20 );
	}

	/**
	 * Adds the tokens as inline CSS to the block stylesheet. It loads on the
	 * front end and inside the editor iframe.
	 *
	 * @return void
	 */
	public function attach() {
		if ( wp_style_is( self::STYLE_HANDLE, 'registered' ) ) {
			wp_add_inline_style( self::STYLE_HANDLE, self::css() );
		}
	}

	/**
	 * The :root rule with all tokens.
	 *
	 * @return string
	 */
	public static function css() {
		$declarations = array();

		foreach ( self::tokens() as $name => $value ) {
			$declarations[] = '--modal-kit-' . $name . ':' . $value;
		}

		return ':root{' . implode( ';', $declarations ) . '}';
	}

	/**
	 * Token values. Missing values fall back inside style.scss.
	 *
	 * @return array<string, string>
	 */
	public static function tokens() {
		$tokens = array(
			'surface' => self::style_value( array( 'color', 'background' ) ),
			'ink'     => self::style_value( array( 'color', 'text' ) ),
			'radius'  => self::radius(),
			'space'   => self::spacing(),
			'shadow'  => self::shadow(),
			'z'       => (string) (int) Settings::value( 'display', 'zIndex' ),
		);

		// The theme's primary color, for the "Theme primary" accent of the
		// fixed styles, with the text that reads on it.
		$primary = self::primary();

		if ( $primary ) {
			$tokens['primary']    = 'var(--wp--preset--color--' . $primary['slug'] . ')';
			$tokens['on-primary'] = Styles::text_on( $primary['color'] );
		}

		/**
		 * Filters the Native style’s tokens (surface, ink, radius, space,
		 * shadow, primary, on-primary).
		 *
		 * @param array<string, string> $tokens CSS values.
		 */
		$tokens = (array) apply_filters( 'modal_kit_theme_tokens', $tokens );

		return array_filter(
			array_map( array( __CLASS__, 'sanitize_css_value' ), $tokens ),
			static function ( $value ) {
				return '' !== $value;
			}
		);
	}

	/**
	 * Reads a global style value and converts preset references to CSS.
	 *
	 * @param string[] $path Path in theme.json styles.
	 * @return string
	 */
	private static function style_value( $path ) {
		$value = wp_get_global_styles( $path );

		return is_string( $value ) ? self::to_css( $value ) : '';
	}

	/**
	 * The theme's button radius ("your theme's radius", mockup 7b).
	 *
	 * @return string
	 */
	private static function radius() {
		$radius = wp_get_global_styles( array( 'elements', 'button', 'border', 'radius' ) );

		if ( is_array( $radius ) ) {
			$radius = reset( $radius );
		}

		return is_string( $radius ) ? self::to_css( $radius ) : '';
	}

	/**
	 * The theme's primary color: the first of the usual primary slugs in its
	 * palette (primary, accent-1 in Twenty Twenty-Five, accent, secondary).
	 *
	 * @return array{slug: string, color: string}|null
	 */
	public static function primary() {
		$palette = wp_get_global_settings( array( 'color', 'palette', 'theme' ) );
		$colors  = array();

		foreach ( is_array( $palette ) ? $palette : array() as $entry ) {
			if ( isset( $entry['slug'], $entry['color'] ) ) {
				$colors[ (string) $entry['slug'] ] = (string) $entry['color'];
			}
		}

		foreach ( array( 'primary', 'accent-1', 'accent', 'secondary' ) as $slug ) {
			if ( isset( $colors[ $slug ] ) && Styles::rgb( $colors[ $slug ] ) ) {
				return array(
					'slug'  => $slug,
					'color' => $colors[ $slug ],
				);
			}
		}

		return null;
	}

	/**
	 * A middle spacing preset, used as the panel padding.
	 *
	 * @return string
	 */
	private static function spacing() {
		$sizes = wp_get_global_settings( array( 'spacing', 'spacingSizes' ) );

		foreach ( array( 'theme', 'default' ) as $origin ) {
			if ( ! empty( $sizes[ $origin ] ) && is_array( $sizes[ $origin ] ) ) {
				$list   = array_values( $sizes[ $origin ] );
				$preset = $list[ (int) round( ( count( $list ) - 1 ) * 0.4 ) ];

				return 'var(--wp--preset--spacing--' . sanitize_key( $preset['slug'] ) . ')';
			}
		}

		return '';
	}

	/**
	 * A large shadow preset, if the theme (or core defaults) provides one.
	 *
	 * @return string
	 */
	private static function shadow() {
		$presets = wp_get_global_settings( array( 'shadow', 'presets' ) );
		$slugs   = array();

		foreach ( array( 'theme', 'default' ) as $origin ) {
			if ( ! empty( $presets[ $origin ] ) && is_array( $presets[ $origin ] ) ) {
				$slugs = array_merge( $slugs, wp_list_pluck( $presets[ $origin ], 'slug' ) );
			}
		}

		foreach ( array( 'deep', 'natural', 'large-dark', 'large', 'medium-dark', 'medium' ) as $preferred ) {
			if ( in_array( $preferred, $slugs, true ) ) {
				return 'var(--wp--preset--shadow--' . $preferred . ')';
			}
		}

		return $slugs ? 'var(--wp--preset--shadow--' . sanitize_key( $slugs[0] ) . ')' : '';
	}

	/**
	 * The theme's look as plain values, for the "Follows your theme" tiles in
	 * the editor sidebar, which can't read the canvas's preset variables:
	 * background, text, primary colour, heading font and button corners.
	 *
	 * @return array<string, string>
	 */
	public static function preview() {
		$colors = array();
		$fonts  = array();

		foreach ( array( 'default', 'theme', 'custom' ) as $origin ) {
			foreach ( (array) wp_get_global_settings( array( 'color', 'palette', $origin ) ) as $entry ) {
				if ( is_array( $entry ) && isset( $entry['slug'], $entry['color'] ) ) {
					$colors[ (string) $entry['slug'] ] = (string) $entry['color'];
				}
			}

			foreach ( (array) wp_get_global_settings( array( 'typography', 'fontFamilies', $origin ) ) as $entry ) {
				if ( is_array( $entry ) && isset( $entry['slug'], $entry['fontFamily'] ) ) {
					$fonts[ (string) $entry['slug'] ] = (string) $entry['fontFamily'];
				}
			}
		}

		// "var:preset|color|base" or "var(--wp--preset--color--base)" → its value.
		$resolve = static function ( $value, $kind, $presets ) {
			$value = is_string( $value ) ? $value : '';

			if ( preg_match( '/^var:preset\|' . $kind . '\|([a-z0-9-]+)$|^var\(--wp--preset--' . $kind . '--([a-z0-9-]+)\)$/', $value, $match ) ) {
				$slug = '' !== $match[1] ? $match[1] : ( $match[2] ?? '' );

				return $presets[ $slug ] ?? '';
			}

			return $value;
		};

		$heading = wp_get_global_styles( array( 'elements', 'heading', 'typography', 'fontFamily' ) );
		$body    = wp_get_global_styles( array( 'typography', 'fontFamily' ) );
		$radius  = wp_get_global_styles( array( 'elements', 'button', 'border', 'radius' ) );
		$radius  = is_array( $radius ) ? reset( $radius ) : $radius;
		$radius  = is_string( $radius ) ? $resolve( $radius, 'border-radius', array() ) : '';
		$primary = self::primary();
		$preview = array(
			'surface' => $resolve( wp_get_global_styles( array( 'color', 'background' ) ), 'color', $colors ),
			'ink'     => $resolve( wp_get_global_styles( array( 'color', 'text' ) ), 'color', $colors ),
			'accent'  => $primary ? $primary['color'] : '',
			'head'    => $resolve( is_string( $heading ) && '' !== $heading ? $heading : $body, 'font-family', $fonts ),
			'radius'  => preg_match( '/^\d*\.?\d+(px|rem|em)$/', (string) $radius ) ? (string) $radius : '',
		);

		return array_map(
			static function ( $value ) {
				return self::sanitize_css_value( $value );
			},
			$preview
		);
	}

	/**
	 * Converts "var:preset|color|base" references to CSS custom properties.
	 *
	 * @param string $value theme.json value.
	 * @return string
	 */
	public static function to_css( $value ) {
		if ( 0 === strpos( $value, 'var:' ) ) {
			$parts = explode( '|', substr( $value, 4 ) );

			return 'var(--wp--' . implode( '--', array_map( 'sanitize_key', $parts ) ) . ')';
		}

		return $value;
	}

	/**
	 * Keeps only characters that can appear in a CSS value; drops anything
	 * that could close the rule.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	public static function sanitize_css_value( $value ) {
		$value = is_scalar( $value ) ? trim( (string) $value ) : '';

		return preg_match( '/^[\w\s#%.,()+\-\/*"\']*$/', $value ) ? $value : '';
	}
}

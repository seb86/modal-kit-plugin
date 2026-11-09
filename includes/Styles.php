<?php
/**
 * Fixed styles.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Fieldnote, Harbor and Night bring their own colors, fonts and radius,
 * unlike Native, Soft and Editorial, which follow the theme. Each is a
 * token set: the built-in ones come from `src/styles/*.json` (copied to
 * `build/styles/`, and compiled into style.scss by bin/build-styles.mjs);
 * `modal_kit_styles` adds more, and their rules are printed inline.
 *
 * A fixed style is a block style of the Modal block (`is-style-{slug}`). The
 * dialog then carries `mk-style mk-style-{slug}`, plus `mk-fonts-theme` when
 * the modal uses the theme's fonts, and inline tokens for its accent.
 */
final class Styles {

	/**
	 * Handle of the bundled fonts' stylesheet.
	 */
	const FONTS_HANDLE = 'modal-kit-fonts';

	/**
	 * Accent choices.
	 */
	const ACCENTS = array( 'style', 'theme', 'custom' );

	/**
	 * Font choices.
	 */
	const FONTS = array( 'style', 'theme' );

	/**
	 * Request cache of all() (null until read).
	 *
	 * @var array<string, array<string, mixed>>|null
	 */
	private static $styles = null;

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		// After block registration (init, 10) so the block and its style exist.
		add_action( 'init', array( $this, 'register' ), 20 );
		add_action( 'enqueue_block_assets', array( $this, 'editor_fonts' ) );
	}

	/**
	 * Registers the fonts stylesheet, a block style per fixed style, and the
	 * rules of styles added by the filter.
	 *
	 * @return void
	 */
	public function register() {
		wp_register_style( self::FONTS_HANDLE, Plugin::url( 'assets/fonts/fonts.css' ), array(), MODAL_KIT_VERSION );

		$extra = array();

		foreach ( self::all() as $slug => $style ) {
			register_block_style(
				'modal-kit/modal',
				array(
					'name'  => $slug,
					'label' => $style['label'],
				)
			);

			if ( empty( $style['builtin'] ) ) {
				$extra[] = self::css( $style );
			}
		}

		if ( $extra && wp_style_is( ThemeTokens::STYLE_HANDLE, 'registered' ) ) {
			wp_add_inline_style( ThemeTokens::STYLE_HANDLE, implode( '', $extra ) );
		}
	}

	/**
	 * The fonts in the editor canvas, where a modal can switch style at any
	 * time. On the site they load only with a modal that needs them.
	 *
	 * @return void
	 */
	public function editor_fonts() {
		if ( ! is_admin() || ! function_exists( 'get_current_screen' ) ) {
			return;
		}

		$screen = get_current_screen();

		if ( $screen && PostType::NAME === $screen->post_type ) {
			wp_enqueue_style( self::FONTS_HANDLE );
		}
	}

	/**
	 * Every fixed style, built-in ones first.
	 *
	 * @return array<string, array<string, mixed>> Styles by slug.
	 */
	public static function all() {
		if ( null !== self::$styles ) {
			return self::$styles;
		}

		$builtin = self::builtin();

		/**
		 * Filters the fixed styles. Each is a token set like
		 * src/styles/fieldnote.json: label, color (surface, ink, muted, line,
		 * field, accent, accent-strong, on-accent, tint, overlay, full-bg,
		 * full-ink, full-accent), font (head, body, mono, head-weight,
		 * head-tracking, head-size), radius (panel, button, field) and shadow.
		 * Fonts other than the bundled ones are the style's to load.
		 *
		 * @param array<string, array<string, mixed>> $styles Styles by slug.
		 */
		$filtered = (array) apply_filters( 'modal_kit_styles', $builtin );
		$styles   = array();

		foreach ( $filtered as $slug => $style ) {
			$slug = sanitize_key( (string) $slug );

			// Slugs of the styles that follow the theme are taken.
			if ( '' === $slug || in_array( $slug, array( 'default', 'soft', 'editorial' ), true ) || ! is_array( $style ) ) {
				continue;
			}

			$style = self::clean( $style );

			if ( $style ) {
				$style['slug']    = $slug;
				$style['builtin'] = isset( $builtin[ $slug ] ) && $builtin[ $slug ] === $filtered[ $slug ];
				$styles[ $slug ]  = $style;
			}
		}

		self::$styles = $styles;

		return $styles;
	}

	/**
	 * Clears the cache (tests, or after a filter is added late).
	 *
	 * @return void
	 */
	public static function flush() {
		self::$styles = null;
	}

	/**
	 * One fixed style.
	 *
	 * @param string $slug Slug.
	 * @return array<string, mixed>|null
	 */
	public static function get( $slug ) {
		$styles = self::all();

		return isset( $styles[ $slug ] ) ? $styles[ $slug ] : null;
	}

	/**
	 * The built-in styles' JSON files.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private static function builtin() {
		$styles = array();

		foreach ( (array) glob( Plugin::path( 'build/styles/*.json' ) ) as $file ) {
			$style = json_decode( (string) file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.

			if ( is_array( $style ) && ! empty( $style['slug'] ) ) {
				$styles[ (string) $style['slug'] ] = $style;
			}
		}

		ksort( $styles );

		return $styles;
	}

	/**
	 * Keeps the known keys with safe CSS values; null without the colors a
	 * style needs.
	 *
	 * @param array<string, mixed> $style Raw style.
	 * @return array<string, mixed>|null
	 */
	private static function clean( $style ) {
		$groups = array(
			'color'  => array( 'surface', 'ink', 'muted', 'line', 'field', 'accent', 'accent-strong', 'on-accent', 'tint', 'overlay', 'full-bg', 'full-ink', 'full-accent' ),
			'font'   => array( 'head', 'body', 'mono', 'head-weight', 'head-tracking', 'head-size' ),
			'radius' => array( 'panel', 'button', 'field' ),
		);
		$clean  = array(
			'label'       => isset( $style['label'] ) ? sanitize_text_field( (string) $style['label'] ) : '',
			'description' => isset( $style['description'] ) ? substr( sanitize_text_field( (string) $style['description'] ), 0, 200 ) : '',
			'version'     => isset( $style['version'] ) ? max( 1, (int) $style['version'] ) : 1,
			'shadow'      => isset( $style['shadow'] ) ? ThemeTokens::sanitize_css_value( $style['shadow'] ) : '',
		);

		foreach ( $groups as $group => $keys ) {
			$clean[ $group ] = array();

			foreach ( $keys as $key ) {
				if ( isset( $style[ $group ][ $key ] ) ) {
					$raw = $style[ $group ][ $key ];
					// Numbers stay numbers (head-weight 600), so an exported
					// style reads like the file it came from.
					$value = is_int( $raw ) || is_float( $raw ) ? $raw : ThemeTokens::sanitize_css_value( $raw );

					if ( '' !== $value ) {
						$clean[ $group ][ $key ] = $value;
					}
				}
			}
		}

		foreach ( array( 'surface', 'ink', 'accent', 'on-accent', 'full-bg', 'full-ink', 'full-accent' ) as $required ) {
			if ( empty( $clean['color'][ $required ] ) || ! self::rgb( $clean['color'][ $required ] ) ) {
				return null;
			}
		}

		if ( '' === $clean['label'] ) {
			return null;
		}

		return $clean;
	}

	/**
	 * The style choice of a modal from its block attributes.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @return array{slug: string, accent: string, accentColor: string, fonts: string}
	 */
	public static function resolve( $attributes ) {
		$slug = '';

		if ( isset( $attributes['className'] ) && preg_match_all( '/(?:^|\s)is-style-([a-z0-9_-]+)/', (string) $attributes['className'], $matches ) ) {
			$last = (string) end( $matches[1] );
			$slug = self::get( $last ) ? $last : '';
		}

		$options = isset( $attributes['styleOptions'] ) && is_array( $attributes['styleOptions'] ) ? $attributes['styleOptions'] : array();
		$accent  = isset( $options['accent'] ) && in_array( $options['accent'], self::ACCENTS, true ) ? $options['accent'] : 'style';
		$color   = isset( $options['accentColor'] ) ? (string) $options['accentColor'] : '';
		$color   = preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $color ) ? strtolower( $color ) : '';

		if ( 'custom' === $accent && '' === $color ) {
			$accent = 'style';
		}

		return array(
			'slug'        => $slug,
			'accent'      => $slug ? $accent : 'style',
			'accentColor' => $slug && 'custom' === $accent ? $color : '',
			'fonts'       => $slug && isset( $options['fonts'] ) && 'theme' === $options['fonts'] ? 'theme' : 'style',
		);
	}

	/**
	 * Dialog classes for a resolved style choice.
	 *
	 * @param array<string, string> $choice Output of resolve().
	 * @return string[]
	 */
	public static function classes( $choice ) {
		if ( '' === $choice['slug'] ) {
			return array();
		}

		$classes = array( 'mk-style', 'mk-style-' . $choice['slug'] );

		if ( 'theme' === $choice['fonts'] ) {
			$classes[] = 'mk-fonts-theme';
		}

		return $classes;
	}

	/**
	 * Inline accent tokens for a resolved style choice. A changed accent
	 * also sets its strong shade (mixed toward the ink) and the text on it
	 * (light or dark, whichever contrasts more), and full-screen and bars
	 * use it too.
	 *
	 * @param array<string, string> $choice Output of resolve().
	 * @return string[] CSS declarations.
	 */
	public static function declarations_for( $choice ) {
		$style = $choice['slug'] ? self::get( $choice['slug'] ) : null;

		if ( ! $style || 'style' === $choice['accent'] ) {
			return array();
		}

		if ( 'custom' === $choice['accent'] ) {
			$accent    = $choice['accentColor'];
			$on_accent = self::text_on( $accent );
		} else {
			$accent    = 'var(--modal-kit-primary,' . $style['color']['accent'] . ')';
			$on_accent = 'var(--modal-kit-on-primary,' . $style['color']['on-accent'] . ')';
		}

		return array(
			'--mk-accent:' . $accent,
			'--mk-accent-strong:color-mix(in srgb,' . $accent . ' 78%,var(--mk-ink))',
			'--mk-on-accent:' . $on_accent,
			'--mk-full-accent:' . $accent,
			'--mk-full-button:' . $accent,
			'--mk-on-full-button:' . $on_accent,
		);
	}

	/**
	 * Whether a modal's style needs the bundled fonts.
	 *
	 * @param array<string, string> $choice Output of resolve().
	 * @return bool
	 */
	public static function needs_fonts( $choice ) {
		return '' !== $choice['slug'] && 'style' === $choice['fonts'];
	}

	/**
	 * The custom properties of a style. Mirrors tokens() in
	 * bin/build-styles.mjs, which compiles the built-in ones.
	 *
	 * @param array<string, mixed> $style Cleaned style.
	 * @return array<string, string> Property => value.
	 */
	public static function tokens( $style ) {
		$color  = $style['color'];
		$font   = $style['font'];
		$dark   = self::luminance( $color['surface'] ) < 0.4;
		$tokens = array();

		foreach ( $color as $name => $value ) {
			// The overlay's color only: the modal's Opacity setting decides.
			$tokens[ $name ] = 'overlay' === $name ? self::opaque( $value ) : $value;
		}

		// Derived: fields sit a step away from the panel, and full-screen
		// buttons use the light ink, or the accent on dark styles.
		$field_bg = '#fff';

		if ( $dark ) {
			$field_bg = '#';

			foreach ( (array) self::rgb( $color['surface'] ) as $channel ) {
				$field_bg .= sprintf( '%02x', (int) round( $channel * 0.75 ) );
			}
		}

		$tokens['field-bg']       = $field_bg;
		$tokens['full-button']    = $dark ? $color['full-accent'] : $color['full-ink'];
		$tokens['on-full-button'] = $color['full-bg'];
		$tokens['scheme']         = $dark ? 'dark' : 'light';

		foreach ( array( 'head', 'body', 'mono' ) as $key ) {
			if ( isset( $font[ $key ] ) ) {
				$tokens[ 'font-' . $key ] = $font[ $key ];
			}
		}

		foreach ( array( 'head-weight', 'head-tracking' ) as $key ) {
			if ( isset( $font[ $key ] ) ) {
				$tokens[ $key ] = $font[ $key ];
			}
		}

		$head_size = isset( $font['head-size'] ) ? (float) $font['head-size'] : 0;

		if ( $head_size > 0 ) {
			$min = (int) round( $head_size * 0.8 );

			$tokens['text-heading'] = sprintf( 'clamp(%1$dpx, %2$dpx + 1.4vw, %3$spx)', $min, $min - 5, $head_size );
		}

		foreach ( $style['radius'] as $key => $value ) {
			$tokens[ 'radius-' . $key ] = $value;
		}

		if ( '' !== $style['shadow'] ) {
			$tokens['shadow'] = $style['shadow'];
		}

		return $tokens;
	}

	/**
	 * The `.mk-style-{slug}` rule of a style.
	 *
	 * @param array<string, mixed> $style Cleaned style with its slug.
	 * @return string
	 */
	public static function css( $style ) {
		$declarations = array();

		foreach ( self::tokens( $style ) as $name => $value ) {
			$declarations[] = '--mk-' . $name . ':' . $value;
		}

		return '.mk-style-' . sanitize_html_class( $style['slug'] ) . '{' . implode( ';', $declarations ) . '}';
	}

	/**
	 * What the editor, Settings and the wizard need: label, the two swatch
	 * colors, and the colors the accent warning checks against.
	 *
	 * @return array<string, array<string, string>>
	 */
	public static function for_js() {
		$list = array();

		foreach ( self::all() as $slug => $style ) {
			$list[ $slug ] = array(
				'label'        => $style['label'],
				'description'  => $style['description'],
				'source'       => UserStyles::source( $slug ),
				'surface'      => $style['color']['surface'],
				'ink'          => $style['color']['ink'],
				'accent'       => $style['color']['accent'],
				'onAccent'     => $style['color']['on-accent'],
				// What a picker tile draws.
				'head'         => (string) ( $style['font']['head'] ?? '' ),
				'headWeight'   => (string) ( $style['font']['head-weight'] ?? '' ),
				'headTracking' => (string) ( $style['font']['head-tracking'] ?? '' ),
				'radiusPanel'  => (string) ( $style['radius']['panel'] ?? '' ),
				'radiusButton' => (string) ( $style['radius']['button'] ?? '' ),
			);
		}

		return $list;
	}

	/**
	 * Font families this site can show: the bundled ones, the theme's
	 * (theme.json) and the Font Library's.
	 *
	 * @return string[]
	 */
	public static function available_fonts() {
		$names = array_keys( self::bundled_fonts() );

		foreach ( array( 'theme', 'custom', 'default' ) as $origin ) {
			foreach ( (array) wp_get_global_settings( array( 'typography', 'fontFamilies', $origin ) ) as $family ) {
				if ( is_array( $family ) ) {
					$names[] = (string) ( $family['name'] ?? '' );
					$names[] = self::first_family( (string) ( $family['fontFamily'] ?? '' ) );
				}
			}
		}

		if ( post_type_exists( 'wp_font_family' ) ) {
			$library = get_posts(
				array(
					'post_type'      => 'wp_font_family',
					'posts_per_page' => 100, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- Bounded list.
					'fields'         => 'ids',
				)
			);

			foreach ( $library as $id ) {
				$names[] = get_the_title( $id );
			}
		}

		return array_values( array_unique( array_filter( $names ) ) );
	}

	/**
	 * The first family of a font stack, unquoted.
	 *
	 * @param string $stack CSS font-family.
	 * @return string
	 */
	public static function first_family( $stack ) {
		$first = explode( ',', $stack )[0];

		return trim( $first, " \t\n\r\0\x0B'\"" );
	}

	/**
	 * Heading or body fonts of a style that this site doesn't have, with
	 * the family the browser uses instead.
	 *
	 * @param array<string, mixed> $style Style.
	 * @return array<int, array{font: string, fallback: string}>
	 */
	public static function missing_fonts( $style ) {
		$have    = array_map( 'strtolower', self::available_fonts() );
		$generic = array( 'serif', 'sans-serif', 'monospace', 'system-ui', 'cursive' );
		$missing = array();

		foreach ( array( 'head', 'body' ) as $key ) {
			$stack = (string) ( $style['font'][ $key ] ?? '' );
			$first = self::first_family( $stack );

			if ( '' === $first || in_array( strtolower( $first ), $generic, true ) || in_array( strtolower( $first ), $have, true ) ) {
				continue;
			}

			$rest      = array_map( 'trim', array_slice( explode( ',', $stack ), 1 ) );
			$missing[] = array(
				'font'     => $first,
				'fallback' => trim( (string) ( $rest[0] ?? 'sans-serif' ), "'\"" ),
			);
		}

		return array_values( array_unique( $missing, SORT_REGULAR ) );
	}

	/**
	 * The bundled fonts: family => font files (assets/fonts/fonts.css).
	 *
	 * @return array<string, string[]>
	 */
	public static function bundled_fonts() {
		$css   = (string) file_get_contents( Plugin::path( 'assets/fonts/fonts.css' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
		$fonts = array();

		if ( preg_match_all( '/@font-face\s*{([^}]*)}/', $css, $faces ) ) {
			foreach ( $faces[1] as $face ) {
				if ( preg_match( '/font-family:\s*["\']?([^;"\']+)/', $face, $family ) && preg_match_all( '/url\(([^)]+\.woff2)\)/', $face, $files ) ) {
					$name           = trim( $family[1] );
					$fonts[ $name ] = array_values( array_unique( array_merge( $fonts[ $name ] ?? array(), array_map( 'basename', $files[1] ) ) ) );
				}
			}
		}

		return $fonts;
	}

	/**
	 * The bundled font files a style uses, for "Include font files".
	 *
	 * @param array<string, mixed> $style Style.
	 * @return string[] File names in assets/fonts.
	 */
	public static function font_files( $style ) {
		$bundled = self::bundled_fonts();
		$files   = array();

		foreach ( array( 'head', 'body', 'mono' ) as $key ) {
			$first = self::first_family( (string) ( $style['font'][ $key ] ?? '' ) );

			if ( isset( $bundled[ $first ] ) ) {
				$files = array_merge( $files, $bundled[ $first ] );
			}
		}

		return array_values( array_unique( $files ) );
	}

	/**
	 * Parses #rgb, #rrggbb or rgb()/rgba().
	 *
	 * @param string $color CSS color.
	 * @return int[]|null [r, g, b].
	 */
	public static function rgb( $color ) {
		$color = trim( (string) $color );

		if ( preg_match( '/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $color, $match ) ) {
			$hex = strlen( $match[1] ) <= 4 ? preg_replace( '/(.)/', '$1$1', substr( $match[1], 0, 3 ) ) : substr( $match[1], 0, 6 );

			return array_map( 'hexdec', str_split( (string) $hex, 2 ) );
		}

		if ( preg_match( '/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i', $color, $match ) ) {
			return array( (int) $match[1], (int) $match[2], (int) $match[3] );
		}

		return null;
	}

	/**
	 * Relative luminance (WCAG 2).
	 *
	 * @param string $color CSS color.
	 * @return float
	 */
	public static function luminance( $color ) {
		$rgb = self::rgb( $color );
		$rgb = $rgb ? $rgb : array( 0, 0, 0 );
		$lin = array();

		foreach ( $rgb as $channel ) {
			$v     = $channel / 255;
			$lin[] = $v <= 0.03928 ? $v / 12.92 : pow( ( $v + 0.055 ) / 1.055, 2.4 );
		}

		return 0.2126 * $lin[0] + 0.7152 * $lin[1] + 0.0722 * $lin[2];
	}

	/**
	 * Contrast ratio (WCAG 2).
	 *
	 * @param string $a CSS color.
	 * @param string $b CSS color.
	 * @return float
	 */
	public static function contrast( $a, $b ) {
		$x = self::luminance( $a );
		$y = self::luminance( $b );

		return ( max( $x, $y ) + 0.05 ) / ( min( $x, $y ) + 0.05 );
	}

	/**
	 * Light or dark text for a background, whichever contrasts more.
	 *
	 * @param string $background CSS color.
	 * @return string
	 */
	public static function text_on( $background ) {
		return self::contrast( '#fff', $background ) >= self::contrast( '#17151f', $background ) ? '#fff' : '#17151f';
	}

	/**
	 * A color without its alpha.
	 *
	 * @param string $color CSS color.
	 * @return string
	 */
	private static function opaque( $color ) {
		if ( preg_match( '/^rgba?\(/i', $color ) ) {
			$rgb = (array) self::rgb( $color );

			return vsprintf( 'rgb(%d %d %d)', $rgb );
		}

		return preg_match( '/^#([0-9a-f]{4}|[0-9a-f]{8})$/i', $color ) ? '#' . substr( $color, 1, strlen( $color ) > 5 ? 6 : 3 ) : $color;
	}
}

<?php
/**
 * Starter patterns.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the starter patterns in patterns/*.php for the modal post type.
 *
 * Pattern files return an array (so every string is translatable) and build
 * their markup with the helpers below, which pick preset slugs from the
 * active theme: patterns use theme.json presets only, whatever the theme
 * calls them.
 */
final class Patterns {

	/**
	 * Pattern categories (mockup 1h), slug => label.
	 *
	 * @return array<string, string>
	 */
	public static function categories() {
		$categories = array(
			'modal-kit-newsletter'   => __( 'Newsletter', 'modal-kit' ),
			'modal-kit-promo'        => __( 'Promo & discount', 'modal-kit' ),
			'modal-kit-announcement' => __( 'Announcement', 'modal-kit' ),
			'modal-kit-exit'         => __( 'Exit offer', 'modal-kit' ),
			'modal-kit-video'        => __( 'Video', 'modal-kit' ),
		);

		/**
		 * Filters the picker's pattern categories.
		 *
		 * @param array<string, string> $categories Slug => label.
		 */
		return (array) apply_filters( 'modal_kit_pattern_categories', $categories );
	}

	/**
	 * Modal settings that come with starters (`settings` in a pattern file):
	 * triggers, rules and overrides, applied when the starter is used.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static $settings = array();

	/**
	 * Starter settings by pattern name, for the picker.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function starter_settings() {
		/**
		 * Filters the modal settings applied with each starter.
		 *
		 * @param array<string, array<string, mixed>> $settings Pattern name => { triggers, rules, overrides }.
		 */
		return (array) apply_filters( 'modal_kit_starter_settings', self::$settings );
	}

	/**
	 * Types inside a collection, offered as filters when it's open (e.g.
	 * Pro's Popups: Newsletter, Coupon…). A starter's type is one of its
	 * pattern categories.
	 *
	 * @return array<string, array<string, string>> Collection => category => label.
	 */
	public static function collection_types() {
		/**
		 * Filters the types inside each collection.
		 *
		 * @param array<string, array<string, string>> $types Collection => category => label.
		 */
		return (array) apply_filters( 'modal_kit_pattern_collection_types', array() );
	}

	/**
	 * Template collections (mockup 2e), slug => label. Empty in the free
	 * plugin; Modal Kit Pro adds Studio, Shop, Events…
	 *
	 * @return array<string, string>
	 */
	public static function collections() {
		/**
		 * Filters the picker's template collections.
		 *
		 * @param array<string, string> $collections Slug => label.
		 */
		return (array) apply_filters( 'modal_kit_pattern_collections', array() );
	}

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'init', array( $this, 'register' ), 20 );
	}

	/**
	 * Registers categories and every pattern file.
	 *
	 * @return void
	 */
	public function register() {
		foreach ( self::categories() + self::collections() as $slug => $label ) {
			register_block_pattern_category( $slug, array( 'label' => $label ) );
		}

		$files = glob( Plugin::path( 'patterns/*.php' ) );

		foreach ( $files ? $files : array() as $file ) {
			$pattern = self::load( $file );

			if ( $pattern ) {
				register_block_pattern( $pattern['name'], $pattern['properties'] );
			}
		}
	}

	/**
	 * Reads a pattern file, which returns slug, title, description,
	 * categories, keywords and content.
	 *
	 * @param string $file Absolute path.
	 * @return array{name: string, properties: array<string, mixed>}|null
	 */
	public static function load( $file ) {
		$data = include $file;

		if ( ! is_array( $data ) || empty( $data['slug'] ) || empty( $data['title'] ) || empty( $data['content'] ) ) {
			return null;
		}

		if ( isset( $data['settings'] ) && is_array( $data['settings'] ) ) {
			self::$settings[ (string) $data['slug'] ] = array_intersect_key( $data['settings'], array_flip( array( 'triggers', 'rules', 'overrides' ) ) );
		}

		return array(
			'name'       => (string) $data['slug'],
			'properties' => array(
				'title'         => (string) $data['title'],
				'description'   => isset( $data['description'] ) ? (string) $data['description'] : '',
				'content'       => (string) $data['content'],
				'categories'    => isset( $data['categories'] ) ? (array) $data['categories'] : array(),
				'keywords'      => isset( $data['keywords'] ) ? (array) $data['keywords'] : array(),
				'postTypes'     => array( PostType::NAME ),
				// Shown by the Modal Kit picker, never inside a modal's own inserter.
				'inserter'      => false,
				'viewportWidth' => 1200,
			),
		);
	}

	/**
	 * A color preset slug from the active theme for a role.
	 *
	 * @param string $role accent | on-accent | contrast | base | accent-soft.
	 * @return string Preset slug, or '' if the theme has no palette.
	 */
	public static function color( $role ) {
		$slugs = self::palette_slugs();

		if ( ! $slugs ) {
			return '';
		}

		if ( 'on-accent' === $role ) {
			return self::on_accent();
		}

		$preferences = array(
			'base'        => array( 'base', 'background', 'white', 'light' ),
			'contrast'    => array( 'contrast', 'main', 'foreground', 'black', 'dark' ),
			'accent'      => array( 'primary', 'accent', 'accent-1', 'accent-3', 'secondary', 'vivid-purple' ),
			'accent-soft' => array( 'tertiary', 'accent-5', 'accent-4', 'base-2', 'secondary', 'pale-cyan-blue' ),
		);

		foreach ( isset( $preferences[ $role ] ) ? $preferences[ $role ] : array() as $candidate ) {
			if ( in_array( $candidate, $slugs, true ) ) {
				return $candidate;
			}
		}

		// Fall back to a palette position: first for base, last for contrast.
		if ( 'contrast' === $role ) {
			return (string) end( $slugs );
		}

		return 'base' === $role ? $slugs[0] : $slugs[ min( 1, count( $slugs ) - 1 ) ];
	}

	/**
	 * A font size preset slug from the active theme.
	 *
	 * @param string $size small | large | x-large.
	 * @return string Preset slug, or '' when the theme has none.
	 */
	public static function font_size( $size ) {
		$sizes = wp_get_global_settings( array( 'typography', 'fontSizes' ) );
		$slugs = array();

		foreach ( array( 'theme', 'default' ) as $origin ) {
			if ( ! empty( $sizes[ $origin ] ) && is_array( $sizes[ $origin ] ) ) {
				$slugs = array_values( wp_list_pluck( $sizes[ $origin ], 'slug' ) );
				break;
			}
		}

		if ( in_array( $size, $slugs, true ) ) {
			return $size;
		}

		if ( ! $slugs ) {
			return '';
		}

		// Theme font sizes are ordered smallest to largest.
		$index = array(
			'small'   => 0,
			'large'   => (int) floor( count( $slugs ) * 0.6 ),
			'x-large' => count( $slugs ) - 1,
		);

		return $slugs[ isset( $index[ $size ] ) ? $index[ $size ] : 0 ];
	}

	/**
	 * Theme palette slugs (theme origin first, then default).
	 *
	 * @return string[]
	 */
	private static function palette_slugs() {
		return array_keys( self::palette() );
	}

	/**
	 * The active palette.
	 *
	 * @return array<string, string> Color by slug.
	 */
	private static function palette() {
		$palette = wp_get_global_settings( array( 'color', 'palette' ) );

		foreach ( array( 'theme', 'default' ) as $origin ) {
			if ( ! empty( $palette[ $origin ] ) && is_array( $palette[ $origin ] ) ) {
				return wp_list_pluck( $palette[ $origin ], 'color', 'slug' );
			}
		}

		return array();
	}

	/**
	 * Which of the theme's text colors reads better on its accent, which can be
	 * pale (Twenty Twenty-Five's is yellow). The base color if a color can't be
	 * worked out, such as a `var()`.
	 *
	 * @return string Preset slug.
	 */
	private static function on_accent() {
		$palette  = self::palette();
		$base     = self::color( 'base' );
		$contrast = self::color( 'contrast' );
		$colors   = array(
			'accent'   => $palette[ self::color( 'accent' ) ] ?? '',
			'base'     => $palette[ $base ] ?? '',
			'contrast' => $palette[ $contrast ] ?? '',
		);

		foreach ( $colors as $color ) {
			if ( ! Styles::rgb( $color ) ) {
				return $base;
			}
		}

		return Styles::contrast( $colors['contrast'], $colors['accent'] ) > Styles::contrast( $colors['base'], $colors['accent'] ) ? $contrast : $base;
	}

	/**
	 * Block comment attributes as JSON, empty values dropped.
	 *
	 * @param array<string, mixed> $attributes Attributes.
	 * @return string JSON, or '' when nothing is left.
	 */
	public static function attrs( $attributes ) {
		$attributes = array_filter( $attributes, array( __CLASS__, 'is_set' ) );

		return $attributes ? (string) wp_json_encode( $attributes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) : '';
	}

	/**
	 * Whether an attribute value should be kept.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	public static function is_set( $value ) {
		return '' !== $value && null !== $value && array() !== $value;
	}

	/**
	 * Block comment opener, e.g. "<!-- wp:paragraph {...} -->".
	 *
	 * @param string               $name       Block name without the core/ namespace.
	 * @param array<string, mixed> $attributes Attributes.
	 * @return string
	 */
	private static function open( $name, $attributes = array() ) {
		$json = self::attrs( $attributes );

		return '<!-- wp:' . $name . ( '' === $json ? '' : ' ' . $json ) . ' -->';
	}

	/**
	 * Class names for preset colors.
	 *
	 * @param string $text       Text color slug.
	 * @param string $background Background color slug.
	 * @return string[]
	 */
	public static function color_classes( $text, $background = '' ) {
		$classes = array();

		if ( $text ) {
			$classes[] = 'has-' . $text . '-color';
		}
		if ( $background ) {
			$classes[] = 'has-' . $background . '-background-color';
		}
		if ( $text ) {
			$classes[] = 'has-text-color';
		}
		if ( $background ) {
			$classes[] = 'has-background';
		}

		return $classes;
	}

	/**
	 * Modal block wrapping inner blocks, locked like the post template.
	 *
	 * @param array<string, mixed> $attributes Modal block attributes.
	 * @param string[]             $inner      Inner block markup.
	 * @return string
	 */
	public static function modal( $attributes, $inner ) {
		$attributes['lock'] = array(
			'move'   => true,
			'remove' => true,
		);

		return self::open( 'modal-kit/modal', $attributes ) . "\n" . implode( "\n\n", $inner ) . "\n<!-- /wp:modal-kit/modal -->";
	}

	/**
	 * Heading block (matches core/heading save).
	 *
	 * @param string               $text Text.
	 * @param array<string, mixed> $args level, textAlign, fontSize.
	 * @return string
	 */
	public static function heading( $text, $args = array() ) {
		$level   = isset( $args['level'] ) ? (int) $args['level'] : 2;
		$attrs   = array(
			'textAlign' => isset( $args['textAlign'] ) ? $args['textAlign'] : null,
			'level'     => 2 === $level ? null : $level,
			'fontSize'  => isset( $args['fontSize'] ) ? $args['fontSize'] : null,
		);
		$classes = array( 'wp-block-heading' );

		if ( $attrs['textAlign'] ) {
			$classes[] = 'has-text-align-' . $attrs['textAlign'];
		}
		if ( $attrs['fontSize'] ) {
			$classes[] = 'has-' . $attrs['fontSize'] . '-font-size';
		}

		return self::open( 'heading', $attrs ) . "\n<h{$level} class=\"" . implode( ' ', $classes ) . '">' . esc_html( $text ) . "</h{$level}>\n<!-- /wp:heading -->";
	}

	/**
	 * Paragraph block (matches core/paragraph save).
	 *
	 * @param string               $text Text.
	 * @param array<string, mixed> $args align, fontSize, eyebrow (uppercase and tracked).
	 * @return string
	 */
	public static function paragraph( $text, $args = array() ) {
		$eyebrow = ! empty( $args['eyebrow'] );
		$attrs   = array(
			'align'    => isset( $args['align'] ) ? $args['align'] : null,
			'style'    => $eyebrow ? array(
				'typography' => array(
					'textTransform' => 'uppercase',
					'letterSpacing' => '0.08em',
				),
			) : null,
			'fontSize' => isset( $args['fontSize'] ) ? $args['fontSize'] : null,
		);
		$classes = array();

		if ( $attrs['align'] ) {
			$classes[] = 'has-text-align-' . $attrs['align'];
		}
		if ( $attrs['fontSize'] ) {
			$classes[] = 'has-' . $attrs['fontSize'] . '-font-size';
		}

		$tag = '<p'
			. ( $classes ? ' class="' . implode( ' ', $classes ) . '"' : '' )
			. ( $eyebrow ? ' style="letter-spacing:0.08em;text-transform:uppercase"' : '' )
			. '>';

		return self::open( 'paragraph', $attrs ) . "\n" . $tag . esc_html( $text ) . "</p>\n<!-- /wp:paragraph -->";
	}

	/**
	 * Buttons block (matches core/buttons and core/button save).
	 *
	 * @param array<int, array<string, mixed>> $buttons Each: text, url, outline, action, copy (text), attrs (extra attributes).
	 * @param array<string, mixed>             $args    justify.
	 * @return string
	 */
	public static function buttons( $buttons, $args = array() ) {
		$inner = array();

		foreach ( $buttons as $button ) {
			$outline = ! empty( $button['outline'] );
			$url     = isset( $button['url'] ) ? (string) $button['url'] : '';
			$attrs   = array(
				'className'        => $outline ? 'is-style-outline' : null,
				// Modal Kit actions live in attributes only; the markup is core's.
				'modalKitAction'   => isset( $button['action'] ) ? $button['action'] : null,
				'modalKitCopyText' => isset( $button['copy'] ) ? $button['copy'] : null,
			);
			// Add-on attributes, e.g. a step target.
			$attrs = array_merge( $attrs, isset( $button['attrs'] ) ? (array) $button['attrs'] : array() );

			$inner[] = self::open( 'button', $attrs ) . "\n"
				. '<div class="wp-block-button' . ( $outline ? ' is-style-outline' : '' ) . '">'
				. '<a class="wp-block-button__link wp-element-button"' . ( $url ? ' href="' . esc_url( $url ) . '"' : '' ) . '>' . esc_html( $button['text'] ) . '</a>'
				. "</div>\n<!-- /wp:button -->";
		}

		$attrs = isset( $args['justify'] ) ? array(
			'layout' => array(
				'type'           => 'flex',
				'justifyContent' => $args['justify'],
			),
		) : array();

		return self::open( 'buttons', $attrs ) . "\n<div class=\"wp-block-buttons\">" . implode( "\n\n", $inner ) . "</div>\n<!-- /wp:buttons -->";
	}

	/**
	 * Group block (matches core/group save).
	 *
	 * @param string[]             $inner Inner block markup.
	 * @param array<string, mixed> $args  layout, backgroundColor, textColor.
	 * @return string
	 */
	public static function group( $inner, $args = array() ) {
		$attrs = array(
			'backgroundColor' => isset( $args['backgroundColor'] ) ? $args['backgroundColor'] : null,
			'textColor'       => isset( $args['textColor'] ) ? $args['textColor'] : null,
			'layout'          => isset( $args['layout'] ) ? $args['layout'] : array( 'type' => 'constrained' ),
		);

		$classes = array_merge( array( 'wp-block-group' ), self::color_classes( (string) $attrs['textColor'], (string) $attrs['backgroundColor'] ) );

		return self::open( 'group', $attrs ) . "\n<div class=\"" . implode( ' ', $classes ) . '">' . implode( "\n\n", $inner ) . "</div>\n<!-- /wp:group -->";
	}
}

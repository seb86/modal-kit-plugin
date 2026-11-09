<?php
/**
 * Layout definitions and resolution of block attributes into classes.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Reads schema/layouts.json (shared with the editor) and turns Modal block
 * attributes into the container classes and variables used by style.scss.
 */
final class Layouts {

	/**
	 * Decoded layouts.json.
	 *
	 * @var array<string, mixed>|null
	 */
	private static $data = null;

	/**
	 * Returns layouts.json.
	 *
	 * @return array<string, mixed>
	 */
	public static function data() {
		if ( null === self::$data ) {
			$json       = file_get_contents( Plugin::path( 'schema/layouts.json' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
			$decoded    = json_decode( (string) $json, true );
			self::$data = is_array( $decoded ) ? $decoded : array();
		}

		$data = self::$data;

		/**
		 * Filters the layouts. Add-ons add their own (Pro: the age gate).
		 * Besides the keys in layouts.json, a layout may set `base` (a
		 * built-in layout whose styles it extends; its class is added too)
		 * and `closable` (false: no close button, Esc or click outside).
		 *
		 * @param array<string, array<string, mixed>> $layouts Layouts by name.
		 */
		$layouts = apply_filters( 'modal_kit_layouts', $data['layouts'] );

		if ( is_array( $layouts ) && isset( $layouts['centered'] ) ) {
			$data['layouts'] = $layouts;
		}

		return $data;
	}

	/**
	 * Definition of one layout, falling back to centered.
	 *
	 * @param string $layout Layout name.
	 * @return array<string, mixed>
	 */
	public static function get( $layout ) {
		$layouts = self::data()['layouts'];

		return isset( $layouts[ $layout ] ) ? $layouts[ $layout ] : $layouts['centered'];
	}

	/**
	 * Normalises Modal block attributes, filling defaults and dropping values
	 * that don't apply to the layout. The layout lives in `modalLayout`, because
	 * `layout` belongs to the layout block support.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @return array<string, mixed>
	 */
	public static function resolve( $attributes ) {
		$data   = self::data();
		$layout = isset( $attributes['modalLayout'] ) && is_string( $attributes['modalLayout'] ) && isset( $data['layouts'][ $attributes['modalLayout'] ] ) ? $attributes['modalLayout'] : 'centered';
		$def    = $data['layouts'][ $layout ];

		$position = isset( $attributes['position'] ) && is_string( $attributes['position'] ) ? $attributes['position'] : '';
		if ( ! in_array( $position, $def['positions'], true ) ) {
			$position = isset( $def['positions'][0] ) ? $def['positions'][0] : '';
		}

		$size = isset( $attributes['size'] ) && in_array( $attributes['size'], $data['sizes'], true ) ? $attributes['size'] : 'm';

		$mobile_choice = isset( $attributes['mobileLayout'] ) && in_array( $attributes['mobileLayout'], $data['mobileChoices'], true ) ? $attributes['mobileLayout'] : 'auto';

		$overlay = wp_parse_args(
			isset( $attributes['overlay'] ) && is_array( $attributes['overlay'] ) ? $attributes['overlay'] : array(),
			array(
				'show'        => true,
				'color'       => '',
				'customColor' => '',
				'opacity'     => 45,
				'blur'        => false,
			)
		);

		$closable = ! isset( $def['closable'] ) || false !== $def['closable'];

		$close = wp_parse_args(
			isset( $attributes['closeOptions'] ) && is_array( $attributes['closeOptions'] ) ? $attributes['closeOptions'] : array(),
			array(
				'button'       => true,
				'esc'          => true,
				'outside'      => true,
				'visibleLabel' => false,
			)
		);

		$animation = isset( $attributes['animation'] ) && in_array( $attributes['animation'], $data['animations'], true ) ? $attributes['animation'] : 'fade-rise';

		return array(
			'layout'       => $layout,
			'position'     => $position,
			'size'         => $size,
			'mobileLayout' => $mobile_choice,
			'mobile'       => self::mobile( $layout, $position, $mobile_choice ),
			'overlay'      => array(
				'show'        => $def['overlay'] && (bool) $overlay['show'],
				'color'       => sanitize_key( (string) $overlay['color'] ),
				'customColor' => self::css_color( $overlay['customColor'] ),
				'opacity'     => max( 0, min( 100, (int) $overlay['opacity'] ) ),
				'blur'        => (bool) $overlay['blur'],
			),
			'closeOptions' => array(
				'button'       => $closable && (bool) $close['button'],
				'esc'          => $closable && (bool) $close['esc'],
				'outside'      => $closable && (bool) $close['outside'],
				// Full-screen close is always a labelled pill.
				'visibleLabel' => 'full' === $layout || (bool) $close['visibleLabel'],
			),
			'animation'    => $animation,
			'modal'        => (bool) $def['modal'],
			'base'         => isset( $def['base'] ) && isset( $data['layouts'][ $def['base'] ] ) ? (string) $def['base'] : '',
			'style'        => Styles::resolve( $attributes ),
		);
	}

	/**
	 * The effective mobile layout class suffix.
	 *
	 * @param string $layout   Desktop layout.
	 * @param string $position Desktop position.
	 * @param string $choice   auto | same | sheet | full | centered.
	 * @return string
	 */
	public static function mobile( $layout, $position, $choice ) {
		if ( 'inline' === $layout ) {
			return 'inline';
		}

		if ( 'auto' === $choice ) {
			return self::get( $layout )['mobile'];
		}

		if ( 'same' === $choice ) {
			return 'bar' === $layout ? 'bar-' . $position : $layout;
		}

		return $choice;
	}

	/**
	 * Classes for the modal container (the dialog, or the editor canvas).
	 *
	 * @param array<string, mixed> $resolved Output of resolve().
	 * @return string[]
	 */
	public static function container_classes( $resolved ) {
		$classes = array(
			'modal-kit',
			'modal-kit--' . $resolved['layout'],
		);

		if ( ! empty( $resolved['base'] ) ) {
			$classes[] = 'modal-kit--' . $resolved['base'];
		}

		array_push(
			$classes,
			'modal-kit--size-' . $resolved['size'],
			'modal-kit--m-' . $resolved['mobile'],
			'modal-kit--anim-' . $resolved['animation']
		);

		if ( $resolved['position'] ) {
			$classes[] = 'modal-kit--pos-' . $resolved['position'];
		}

		if ( $resolved['overlay']['show'] ) {
			$classes[] = 'has-overlay';

			if ( $resolved['overlay']['blur'] ) {
				$classes[] = 'has-overlay-blur';
			}
		}

		if ( isset( $resolved['style'] ) ) {
			$classes = array_merge( $classes, Styles::classes( $resolved['style'] ) );
		}

		return $classes;
	}

	/**
	 * A custom color from the color picker: hex, rgb(a) or hsl(a), else ''.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	public static function css_color( $value ) {
		$value = trim( is_string( $value ) ? $value : '' );

		if ( preg_match( '/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $value ) ) {
			return $value;
		}

		return preg_match( '/^(?:rgb|hsl)a?\\([\\d\\s.,%\\/deg]+\\)$/i', $value ) ? $value : '';
	}

	/**
	 * Inline CSS variables for the modal container.
	 *
	 * @param array<string, mixed> $resolved Output of resolve().
	 * @return string
	 */
	public static function container_style( $resolved ) {
		$styles = array();

		if ( $resolved['overlay']['show'] ) {
			if ( $resolved['overlay']['color'] ) {
				$styles[] = '--modal-kit-overlay-color:var(--wp--preset--color--' . $resolved['overlay']['color'] . ')';
			} elseif ( $resolved['overlay']['customColor'] ) {
				$styles[] = '--modal-kit-overlay-color:' . $resolved['overlay']['customColor'];
			}
			$styles[] = '--modal-kit-overlay-opacity:' . ( $resolved['overlay']['opacity'] / 100 );
		}

		if ( isset( $resolved['style'] ) ) {
			$styles = array_merge( $styles, Styles::declarations_for( $resolved['style'] ) );
		}

		return implode( ';', $styles );
	}
}

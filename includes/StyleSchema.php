<?php
/**
 * Style import and export checks.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Mirrors src/styles/schema.js, from the same schema/style.json: every value
 * is sanitised to a colour, length or font stack (url(), expression, `;` and
 * `}` never get through), unknown keys are ignored, missing ones come from
 * Fieldnote, and the S1 contrast test decides whether a style may be saved.
 */
final class StyleSchema {

	/**
	 * Token groups.
	 */
	const GROUPS = array( 'color', 'font', 'radius' );

	/**
	 * Anything that could reach outside a CSS value.
	 */
	const FORBIDDEN = '/url\s*\(|expression|javascript:|[;{}<>\\\\@]/i';

	/**
	 * The decoded schema/style.json (null until read).
	 *
	 * @var array<string, mixed>|null
	 */
	private static $schema = null;

	/**
	 * The schema.
	 *
	 * @return array<string, mixed>
	 */
	public static function schema() {
		if ( null === self::$schema ) {
			$json         = json_decode( (string) file_get_contents( Plugin::path( 'schema/style.json' ) ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
			self::$schema = is_array( $json ) ? $json : array();
		}

		return self::$schema;
	}

	/**
	 * Fieldnote's tokens, which fill whatever an import leaves out.
	 *
	 * @return array<string, mixed>
	 */
	public static function fieldnote() {
		$json = json_decode( (string) file_get_contents( Plugin::path( 'build/styles/fieldnote.json' ) ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.

		return is_array( $json ) ? $json : array();
	}

	/**
	 * The style's keys, by group, with their kind.
	 *
	 * @return array<int, array{0: string|null, 1: string, 2: string}>
	 */
	public static function keys() {
		$schema = self::schema();
		$list   = array();

		foreach ( self::GROUPS as $group ) {
			foreach ( (array) ( $schema['properties'][ $group ]['properties'] ?? array() ) as $key => $spec ) {
				$list[] = array( $group, (string) $key, (string) ( $spec['x-kind'] ?? '' ) );
			}
		}

		$list[] = array( null, 'shadow', (string) ( $schema['properties']['shadow']['x-kind'] ?? 'shadow' ) );

		return $list;
	}

	/**
	 * A value cleaned for its kind, or null when it isn't one.
	 *
	 * @param string $kind  color, length, family, weight, size or shadow.
	 * @param mixed  $value Raw value.
	 * @return string|int|float|null
	 */
	public static function sanitize_value( $kind, $value ) {
		if ( ! is_string( $value ) && ! is_int( $value ) && ! is_float( $value ) ) {
			return null;
		}

		$text = trim( (string) $value );

		if ( preg_match( self::FORBIDDEN, $text ) ) {
			return null;
		}

		switch ( $kind ) {
			case 'weight':
				return preg_match( '/^\d{3}$/', $text ) && (int) $text >= 100 && (int) $text <= 900 ? (int) $text : null;

			case 'size':
				// 36 or "36px" (Harbor), kept as given so a round trip matches.
				return preg_match( '/^\d+(?:\.\d+)?(?:px)?$/', $text ) && (float) $text >= 8 && (float) $text <= 120 ? $value : null;

			case 'shadow':
				$ok = preg_match( '/^[#a-z0-9 .,()%-]{1,200}$/i', $text ) && ! preg_match( '/\b(?!rgba?\()[a-z-]+\(/i', $text );

				return $ok || 'none' === $text ? $text : null;

			case 'color':
				return preg_match( '/^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+))?\s*\))$/i', $text ) ? $text : null;

			case 'length':
				return preg_match( '/^(?:0|-?\d*\.?\d+(?:px|em|rem|%|vw|vh|ch))$/', $text ) ? $text : null;

			case 'family':
				return preg_match( '/^[a-z0-9 ,\'"-]{1,200}$/i', $text ) ? $text : null;
		}

		return null;
	}

	/**
	 * A slug from a name.
	 *
	 * @param string $name Name.
	 * @return string
	 */
	public static function slugify( $name ) {
		$slug = strtolower( remove_accents( (string) $name ) );
		$slug = trim( (string) preg_replace( '/[^a-z0-9]+/', '-', $slug ), '-' );

		return rtrim( substr( $slug, 0, 40 ), '-' );
	}

	/**
	 * Reads an imported style: the clean style and what was filled in,
	 * rejected or ignored.
	 *
	 * @param mixed $raw Decoded JSON.
	 * @return array{style: array<string, mixed>|null, missing: string[], invalid: string[], ignored: string[], error: string}
	 */
	public static function read( $raw ) {
		$result = array(
			'style'   => null,
			'missing' => array(),
			'invalid' => array(),
			'ignored' => array(),
			'error'   => '',
		);

		if ( ! is_array( $raw ) || wp_is_numeric_array( $raw ) ) {
			$result['error'] = 'not-a-style';

			return $result;
		}

		$label    = isset( $raw['label'] ) && is_string( $raw['label'] ) ? substr( trim( str_replace( array( '<', '>' ), '', $raw['label'] ) ), 0, 60 ) : '';
		$style    = array(
			'slug'        => self::slugify( isset( $raw['slug'] ) && is_string( $raw['slug'] ) && '' !== $raw['slug'] ? $raw['slug'] : $label ),
			'label'       => $label,
			'description' => isset( $raw['description'] ) && is_string( $raw['description'] ) ? substr( trim( str_replace( array( '<', '>' ), '', $raw['description'] ) ), 0, 200 ) : '',
			'version'     => isset( $raw['version'] ) && is_int( $raw['version'] ) && $raw['version'] > 0 ? $raw['version'] : 1,
		);
		$fallback = self::fieldnote();

		foreach ( self::keys() as list( $group, $key, $kind ) ) {
			$source = null === $group ? $raw : ( isset( $raw[ $group ] ) && is_array( $raw[ $group ] ) ? $raw[ $group ] : array() );
			$spare  = null === $group ? ( $fallback[ $key ] ?? null ) : ( $fallback[ $group ][ $key ] ?? null );
			$path   = null === $group ? $key : $group . '.' . $key;
			$value  = null;

			if ( array_key_exists( $key, $source ) ) {
				$value = self::sanitize_value( $kind, $source[ $key ] );

				if ( null === $value ) {
					$result['invalid'][] = $path;
				}
			} elseif ( null !== $spare ) {
				$result['missing'][] = $path;
			}

			$value = null === $value ? $spare : $value;

			if ( null !== $value ) {
				if ( null === $group ) {
					$style[ $key ] = $value;
				} else {
					$style[ $group ][ $key ] = $value;
				}
			}
		}

		$schema = self::schema();

		foreach ( $raw as $key => $value ) {
			if ( ! isset( $schema['properties'][ $key ] ) ) {
				$result['ignored'][] = (string) $key;
			} elseif ( in_array( $key, self::GROUPS, true ) && is_array( $value ) ) {
				foreach ( array_keys( $value ) as $inner ) {
					if ( ! isset( $schema['properties'][ $key ]['properties'][ $inner ] ) ) {
						$result['ignored'][] = $key . '.' . $inner;
					}
				}
			}
		}

		if ( '' === $style['label'] ) {
			$result['error'] = 'no-name';
		}

		$result['style'] = $style;

		return $result;
	}

	/**
	 * The contrast test: text pairs at 4.5:1, field borders at 3:1.
	 *
	 * @param array<string, mixed> $style Clean style.
	 * @return array{pass: bool, failures: array<int, array{fg: string, bg: string, ratio: float, min: float}>, summary: array<string, float>}
	 */
	public static function contrast( $style ) {
		$failures = array();
		$summary  = array();

		foreach ( (array) ( self::schema()['x-contrast'] ?? array() ) as $pair ) {
			list( $fg, $bg, $min, $name ) = $pair;

			$ratio = Styles::contrast( (string) ( $style['color'][ $fg ] ?? '' ), (string) ( $style['color'][ $bg ] ?? '' ) );

			if ( '' !== $name ) {
				$summary[ $name ] = $ratio;
			}

			if ( $ratio < $min ) {
				$failures[] = array(
					'fg'    => $fg,
					'bg'    => $bg,
					'ratio' => round( $ratio, 2 ),
					'min'   => (float) $min,
				);
			}
		}

		return array(
			'pass'     => ! $failures,
			'failures' => $failures,
			'summary'  => $summary,
		);
	}

	/**
	 * A slug and name that don't clash: "terracotta-2" / "Terracotta 2".
	 *
	 * @param string   $slug  Wanted slug.
	 * @param string   $label Wanted name.
	 * @param string[] $taken Slugs in use.
	 * @return array{slug: string, label: string}
	 */
	public static function free_slug( $slug, $label, $taken ) {
		if ( ! in_array( $slug, $taken, true ) ) {
			return array(
				'slug'  => $slug,
				'label' => $label,
			);
		}

		$n = 2;

		while ( in_array( $slug . '-' . $n, $taken, true ) ) {
			++$n;
		}

		return array(
			'slug'  => $slug . '-' . $n,
			'label' => $label . ' ' . $n,
		);
	}

	/**
	 * The export format, as src/styles/schema.js writes it: two-space JSON,
	 * keys in a fixed order, so a round trip gives the same file.
	 *
	 * @param array<string, mixed> $style Clean style.
	 * @return string
	 */
	public static function export_json( $style ) {
		$ordered = array(
			'slug'        => (string) $style['slug'],
			'label'       => (string) $style['label'],
			'description' => (string) ( $style['description'] ?? '' ),
			'version'     => (int) ( $style['version'] ?? 1 ),
		);

		foreach ( self::GROUPS as $group ) {
			$ordered[ $group ] = (object) ( $style[ $group ] ?? array() );
		}

		if ( ! empty( $style['shadow'] ) ) {
			$ordered['shadow'] = $style['shadow'];
		}

		$json = (string) wp_json_encode( $ordered, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		// PHP indents with four spaces, JSON.stringify( …, 2 ) with two.
		$json = (string) preg_replace_callback(
			'/^( +)/m',
			static function ( $indent ) {
				return str_repeat( ' ', (int) ( strlen( $indent[1] ) / 2 ) );
			},
			$json
		);

		return $json . "\n";
	}
}

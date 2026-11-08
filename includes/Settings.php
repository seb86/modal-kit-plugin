<?php
/**
 * Site settings.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Registers one option per Settings tab from schema/settings.json and reads
 * them with defaults filled in.
 */
final class Settings {

	/**
	 * Option name prefix.
	 */
	const PREFIX = 'modal_kit_';

	/**
	 * Settings group used by register_setting.
	 */
	const GROUP = 'modal_kit';

	/**
	 * Decoded schema cache.
	 *
	 * @var array<string, array<string, mixed>>|null
	 */
	private static $schema = null;

	/**
	 * Request cache of option values.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static $cache = array();

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'init', array( $this, 'register' ) );

		foreach ( array_keys( self::schema() ) as $tab ) {
			add_action( 'update_option_' . self::PREFIX . $tab, array( __CLASS__, 'flush' ) );
			add_action( 'add_option_' . self::PREFIX . $tab, array( __CLASS__, 'flush' ) );
		}

		// Another plugin moving to another site on a network mid-request.
		add_action( 'switch_blog', array( __CLASS__, 'flush' ) );
	}

	/**
	 * Registers each tab's option for the Settings API and REST.
	 *
	 * @return void
	 */
	public function register() {
		foreach ( self::schema() as $tab => $schema ) {
			register_setting(
				self::GROUP,
				self::PREFIX . $tab,
				array(
					'type'              => 'object',
					'default'           => $schema['default'],
					'sanitize_callback' => static function ( $value ) use ( $tab ) {
						return Settings::sanitize( $tab, $value );
					},
					'show_in_rest'      => array(
						'schema' => self::rest_schema( $schema ),
					),
				)
			);
		}
	}

	/**
	 * The schema for every tab, or one.
	 *
	 * @param string|null $tab Tab name.
	 * @return array<string, mixed>
	 */
	public static function schema( $tab = null ) {
		if ( null === self::$schema ) {
			$json         = file_get_contents( Plugin::path( 'schema/settings.json' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
			$decoded      = json_decode( (string) $json, true );
			self::$schema = is_array( $decoded ) ? $decoded : array();
			unset( self::$schema['$comment'] );
		}

		if ( null === $tab ) {
			return self::$schema;
		}

		return isset( self::$schema[ $tab ] ) ? self::$schema[ $tab ] : array();
	}

	/**
	 * REST schema: properties carry their own defaults so the settings
	 * endpoint can fill missing keys.
	 *
	 * @param array<string, mixed> $schema Tab schema.
	 * @return array<string, mixed>
	 */
	private static function rest_schema( $schema ) {
		foreach ( $schema['properties'] as $key => $property ) {
			if ( array_key_exists( $key, $schema['default'] ) ) {
				$schema['properties'][ $key ]['default'] = $schema['default'][ $key ];
			}
		}

		return $schema;
	}

	/**
	 * A tab's settings, with defaults for missing keys.
	 *
	 * @param string $tab general | display | accessibility | tools | pro.
	 * @return array<string, mixed>
	 */
	public static function get( $tab ) {
		if ( ! isset( self::$cache[ $tab ] ) ) {
			$schema = self::schema( $tab );
			$stored = get_option( self::PREFIX . $tab, array() );

			self::$cache[ $tab ] = array_merge( $schema['default'], is_array( $stored ) ? $stored : array() );
		}

		return self::$cache[ $tab ];
	}

	/**
	 * One setting.
	 *
	 * @param string $tab Tab name.
	 * @param string $key Setting key.
	 * @return mixed
	 */
	public static function value( $tab, $key ) {
		$settings = self::get( $tab );

		return isset( $settings[ $key ] ) ? $settings[ $key ] : null;
	}

	/**
	 * Validates a tab's value against its schema, key by key: invalid keys
	 * fall back to their defaults and unknown keys are dropped.
	 *
	 * @param string $tab   Tab name.
	 * @param mixed  $value Raw value.
	 * @return array<string, mixed>
	 */
	public static function sanitize( $tab, $value ) {
		$schema = self::schema( $tab );
		$value  = is_array( $value ) ? $value : array();
		$clean  = array();

		foreach ( $schema['properties'] as $key => $property ) {
			if ( ! array_key_exists( $key, $value ) || true !== rest_validate_value_from_schema( $value[ $key ], $property, $key ) ) {
				$clean[ $key ] = $schema['default'][ $key ];
				continue;
			}

			$clean[ $key ] = rest_sanitize_value_from_schema( $value[ $key ], $property, $key );
		}

		return $clean;
	}

	/**
	 * Clears the request cache after an update.
	 *
	 * @return void
	 */
	public static function flush() {
		self::$cache = array();
	}
}

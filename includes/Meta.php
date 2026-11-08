<?php
/**
 * Post meta for triggers, rules and overrides.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Registers modal meta from the shared JSON schema (schema/modal-meta.json).
 */
final class Meta {

	/**
	 * Meta key prefix. Protected (leading underscore) so it stays out of the
	 * Custom Fields panel.
	 */
	const PREFIX = '_modal_kit_';

	/**
	 * Schema keys that become meta.
	 */
	const KEYS = array( 'enabled', 'triggers', 'rules', 'overrides' );

	/**
	 * Decoded schema cache.
	 *
	 * @var array<string, array<string, mixed>>|null
	 */
	private static $schema = null;

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'init', array( $this, 'register' ) );
	}

	/**
	 * Registers each meta key with its schema.
	 *
	 * @return void
	 */
	public function register() {
		foreach ( self::KEYS as $key ) {
			$schema = self::schema( $key );

			register_post_meta(
				PostType::NAME,
				self::PREFIX . $key,
				array(
					'type'              => $schema['type'],
					'description'       => isset( $schema['description'] ) ? $schema['description'] : '',
					'single'            => true,
					'default'           => $schema['default'],
					'sanitize_callback' => static function ( $value ) use ( $schema ) {
						return Meta::sanitize( $value, $schema );
					},
					'auth_callback'     => static function ( $allowed, $meta_key, $post_id ) {
						return current_user_can( 'edit_post', $post_id );
					},
					'show_in_rest'      => array(
						'schema' => $schema,
					),
				)
			);
		}
	}

	/**
	 * Returns the schema for one meta key, or all of them.
	 *
	 * @param string|null $key Schema key (triggers, rules, overrides).
	 * @return array<string, mixed>
	 */
	public static function schema( $key = null ) {
		if ( null === self::$schema ) {
			$json         = file_get_contents( Plugin::path( 'schema/modal-meta.json' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
			$decoded      = json_decode( (string) $json, true );
			self::$schema = is_array( $decoded ) ? $decoded : array();
			unset( self::$schema['$comment'] );
		}

		if ( null === $key ) {
			return self::$schema;
		}

		$schema = isset( self::$schema[ $key ] ) ? self::$schema[ $key ] : array();

		/**
		 * Filters a meta schema, e.g. to add trigger types or rule fields.
		 *
		 * @param array<string, mixed> $schema Schema.
		 * @param string               $key    triggers | rules | overrides | enabled.
		 */
		$schema = (array) apply_filters( 'modal_kit_meta_schema', $schema, $key );

		// New modals wait the site's default number of days (setup wizard, 7c).
		if ( 'rules' === $key && class_exists( Settings::class ) ) {
			$schema['default']['frequency']['days'] = (int) Settings::value( 'general', 'defaultWaitDays' );
		}

		return $schema;
	}

	/**
	 * Validates and sanitizes a value against a schema. Invalid values fall
	 * back to the schema default.
	 *
	 * @param mixed                $value  Raw value.
	 * @param array<string, mixed> $schema Schema.
	 * @return mixed
	 */
	public static function sanitize( $value, $schema ) {
		if ( true !== rest_validate_value_from_schema( $value, $schema ) ) {
			return $schema['default'];
		}

		return rest_sanitize_value_from_schema( $value, $schema );
	}

	/**
	 * Reads a meta value, filling in defaults for missing keys.
	 *
	 * @param int    $post_id Modal ID.
	 * @param string $key     Schema key (triggers, rules, overrides).
	 * @return mixed
	 */
	public static function get( $post_id, $key ) {
		$schema = self::schema( $key );

		if ( ! $post_id || ! metadata_exists( 'post', $post_id, self::PREFIX . $key ) ) {
			return $schema['default'];
		}

		$value = get_post_meta( $post_id, self::PREFIX . $key, true );

		// WordPress stores false as ''.
		if ( 'boolean' === $schema['type'] ) {
			return (bool) $value;
		}

		// Missing, invalid post ID (false), or the wrong shape: use the default.
		if ( '' === $value || null === $value || false === $value || ( is_array( $schema['default'] ) && ! is_array( $value ) ) ) {
			return $schema['default'];
		}

		if ( is_array( $value ) && is_array( $schema['default'] ) && 'object' === $schema['type'] ) {
			return self::merge_defaults( $value, $schema['default'] );
		}

		return $value;
	}

	/**
	 * Recursively fills missing object keys from defaults. Lists are kept as stored.
	 *
	 * @param array<string, mixed> $value    Stored value.
	 * @param array<string, mixed> $defaults Defaults.
	 * @return array<string, mixed>
	 */
	public static function merge_defaults( $value, $defaults ) {
		foreach ( $defaults as $key => $default ) {
			if ( ! array_key_exists( $key, $value ) ) {
				$value[ $key ] = $default;
			} elseif ( is_array( $default ) && is_array( $value[ $key ] ) && array() !== $default && ! wp_is_numeric_array( $default ) ) {
				$value[ $key ] = self::merge_defaults( $value[ $key ], $default );
			}
		}

		return $value;
	}
}

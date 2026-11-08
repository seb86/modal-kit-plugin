<?php
/**
 * Export and import (mockup 5d).
 *
 * @package ModalKit
 */

namespace ModalKit\Rest;

use ModalKit\Meta;
use ModalKit\PostType;
use ModalKit\Settings;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * GET /modal-kit/v1/export and POST /modal-kit/v1/import. Moves modals (with
 * their triggers, rules and overrides) and optionally the settings between
 * sites. Administrators only.
 */
final class Tools {

	/**
	 * REST namespace.
	 */
	const NAMESPACE = 'modal-kit/v1';

	/**
	 * Export format version.
	 */
	const FORMAT = 1;

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	/**
	 * Registers the routes.
	 *
	 * @return void
	 */
	public function routes() {
		register_rest_route(
			self::NAMESPACE,
			'/export',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'export' ),
				'permission_callback' => array( $this, 'can_manage' ),
				'args'                => array(
					'settings' => array(
						'type'    => 'boolean',
						'default' => true,
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/import',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'import' ),
				'permission_callback' => array( $this, 'can_manage' ),
				'args'                => array(
					'data'    => array(
						'type'     => 'object',
						'required' => true,
					),
					'replace' => array(
						'type'    => 'boolean',
						'default' => false,
					),
				),
			)
		);
	}

	/**
	 * Only administrators move modals and settings between sites.
	 *
	 * @return bool
	 */
	public function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Builds the export.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function export( WP_REST_Request $request ) {
		$posts  = get_posts(
			array(
				'post_type'      => PostType::NAME,
				'post_status'    => array( 'publish', 'draft', 'future', 'private' ),
				'posts_per_page' => -1,
				'orderby'        => 'ID',
				'order'          => 'ASC',
			)
		);
		$modals = array();

		foreach ( $posts as $post ) {
			$meta = array();

			foreach ( Meta::KEYS as $key ) {
				$meta[ $key ] = Meta::get( $post->ID, $key );
			}

			$modals[] = array(
				'slug'    => $post->post_name,
				'title'   => $post->post_title,
				'status'  => $post->post_status,
				'content' => $post->post_content,
				'meta'    => $meta,
			);
		}

		$export = array(
			'format'  => self::FORMAT,
			'plugin'  => 'modal-kit',
			'version' => MODAL_KIT_VERSION,
			'site'    => home_url( '/' ),
			'modals'  => $modals,
		);

		if ( $request['settings'] ) {
			foreach ( array_keys( Settings::schema() ) as $tab ) {
				$export['settings'][ $tab ] = Settings::get( $tab );
			}

			unset( $export['settings']['tools']['deleteOnUninstall'] );
		}

		return new WP_REST_Response( $export );
	}

	/**
	 * Imports modals and settings.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function import( WP_REST_Request $request ) {
		$data = (array) $request['data'];

		if ( ! isset( $data['plugin'], $data['modals'] ) || 'modal-kit' !== $data['plugin'] || ! is_array( $data['modals'] ) ) {
			return new WP_Error( 'modal_kit_import_invalid', __( 'This isn’t a Modal Kit export file.', 'modal-kit' ), array( 'status' => 400 ) );
		}

		$result = array(
			'created'  => 0,
			'updated'  => 0,
			'skipped'  => 0,
			'settings' => false,
		);

		foreach ( $data['modals'] as $modal ) {
			if ( ! is_array( $modal ) || empty( $modal['slug'] ) || ! isset( $modal['content'] ) ) {
				++$result['skipped'];
				continue;
			}

			$slug     = sanitize_title( $modal['slug'] );
			$existing = get_page_by_path( $slug, OBJECT, PostType::NAME );

			if ( $existing && ! $request['replace'] ) {
				++$result['skipped'];
				continue;
			}

			$postarr = array(
				'post_type'    => PostType::NAME,
				'post_name'    => $slug,
				'post_title'   => isset( $modal['title'] ) ? sanitize_text_field( $modal['title'] ) : $slug,
				'post_status'  => isset( $modal['status'] ) && in_array( $modal['status'], array( 'publish', 'draft', 'private' ), true ) ? $modal['status'] : 'draft',
				// A file can come from anyone, so even an administrator's import
				// is cleaned, on top of the usual kses filters for the current user.
				'post_content' => wp_slash( \ModalKit\Hardening::strip_directives( wp_kses_post( (string) $modal['content'] ) ) ),
			);

			if ( $existing ) {
				$postarr['ID'] = $existing->ID;
			}

			$id = wp_insert_post( $postarr, true );

			if ( is_wp_error( $id ) ) {
				++$result['skipped'];
				continue;
			}

			foreach ( Meta::KEYS as $key ) {
				if ( isset( $modal['meta'][ $key ] ) ) {
					// Sanitised against the schema by the registered meta.
					update_post_meta( $id, Meta::PREFIX . $key, wp_slash( $modal['meta'][ $key ] ) );
				}
			}

			++$result[ $existing ? 'updated' : 'created' ];
		}

		if ( ! empty( $data['settings'] ) && is_array( $data['settings'] ) ) {
			foreach ( array_keys( Settings::schema() ) as $tab ) {
				if ( isset( $data['settings'][ $tab ] ) ) {
					$value = Settings::sanitize( $tab, $data['settings'][ $tab ] );

					// Whether deleting the plugin deletes the data is this site's own choice.
					if ( 'tools' === $tab ) {
						$value['deleteOnUninstall'] = Settings::get( 'tools' )['deleteOnUninstall'];
					}

					update_option( Settings::PREFIX . $tab, $value );
					$result['settings'] = true;
				}
			}
		}

		return new WP_REST_Response( $result );
	}
}

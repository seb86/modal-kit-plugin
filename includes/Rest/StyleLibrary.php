<?php
/**
 * Style import, export, duplicate and delete.
 *
 * @package ModalKit
 */

namespace ModalKit\Rest;

use ModalKit\Plugin;
use ModalKit\StyleSchema;
use ModalKit\Styles;
use ModalKit\UserStyles;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * REST routes for Settings → Styles and the Styles tab's ⋮ menu, all for
 * administrators (`manage_options`). Several styles, or styles with their
 * font files, download as a .zip from admin-post.php.
 */
final class StyleLibrary {

	/**
	 * REST namespace.
	 */
	const REST_NAMESPACE = 'modal-kit/v1';

	/**
	 * The admin-post action of the .zip export.
	 */
	const EXPORT_ACTION = 'modal_kit_export_styles';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
		add_action( 'admin_post_' . self::EXPORT_ACTION, array( $this, 'export_zip' ) );
	}

	/**
	 * Whether the user may manage styles.
	 *
	 * @return bool
	 */
	public function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * REST routes.
	 *
	 * @return void
	 */
	public function routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/styles',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'permission_callback' => array( $this, 'can_manage' ),
					'callback'            => array( $this, 'list_styles' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'permission_callback' => array( $this, 'can_manage' ),
					'callback'            => array( $this, 'import' ),
					'args'                => array(
						'style'       => array(
							'type'     => 'object',
							'required' => true,
						),
						'mode'        => array(
							'type'    => 'string',
							'enum'    => array( 'copy', 'replace' ),
							'default' => 'copy',
						),
						'label'       => array( 'type' => 'string' ),
						'description' => array( 'type' => 'string' ),
						// A new style made here (the Pro Style editor) is "Yours".
						'source'      => array(
							'type'    => 'string',
							'enum'    => array( 'imported', 'yours' ),
							'default' => 'imported',
						),
					),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/styles/(?P<slug>[a-z0-9_-]+)/duplicate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => array( $this, 'can_manage' ),
				'callback'            => array( $this, 'duplicate' ),
				'args'                => array(
					'label'       => array( 'type' => 'string' ),
					'description' => array( 'type' => 'string' ),
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/styles/(?P<slug>[a-z0-9_-]+)',
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'permission_callback' => array( $this, 'can_manage' ),
				'callback'            => array( $this, 'delete' ),
				'args'                => array(
					'reassign' => array(
						'type'    => 'string',
						'pattern' => '^[a-z0-9_-]{1,60}$',
					),
				),
			)
		);
	}

	/**
	 * One style for Settings → Styles: who made it, who uses it, its JSON.
	 *
	 * @param string $slug Slug.
	 * @return array<string, mixed>
	 */
	public static function item( $slug ) {
		$style  = (array) Styles::get( $slug );
		$stored = UserStyles::all()[ $slug ] ?? array();
		$clean  = array_intersect_key( $style, array_flip( array( 'slug', 'label', 'description', 'version', 'color', 'font', 'radius', 'shadow' ) ) );

		return array(
			'slug'        => $slug,
			'label'       => (string) ( $style['label'] ?? $slug ),
			'description' => (string) ( $style['description'] ?? '' ),
			'source'      => UserStyles::source( $slug ),
			'from'        => (string) ( $stored['from'] ?? '' ),
			'usedBy'      => count( UserStyles::modals_using( $slug ) ),
			'json'        => StyleSchema::export_json( $clean + array( 'slug' => $slug ) ),
			'tile'        => Styles::for_js()[ $slug ] ?? array(),
		);
	}

	/**
	 * Every fixed style.
	 *
	 * @return \WP_REST_Response
	 */
	public function list_styles() {
		return rest_ensure_response(
			array(
				'styles' => array_map( array( __CLASS__, 'item' ), array_keys( Styles::all() ) ),
				'fonts'  => Styles::available_fonts(),
			)
		);
	}

	/**
	 * Imports a style: checks it, settles a name clash, saves it.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response|WP_Error
	 */
	public function import( WP_REST_Request $request ) {
		$read = StyleSchema::read( $request->get_param( 'style' ) );

		foreach ( array( 'label', 'description' ) as $field ) {
			$value = $request->get_param( $field );

			if ( is_string( $value ) && null !== $read['style'] ) {
				$read['style'][ $field ] = sanitize_text_field( $value );
			}
		}

		if ( null === $read['style'] || '' !== $read['error'] || '' === $read['style']['label'] ) {
			return new WP_Error( 'modal_kit_style', __( 'This file isn’t a Modal Kit style. It needs at least a name.', 'modal-kit' ), array( 'status' => 400 ) );
		}

		$style    = $read['style'];
		$contrast = StyleSchema::contrast( $style );

		// Contrast is reported, not enforced (#137): the result goes back with
		// the saved style, and the import dialog and Style editor warn.

		$style['slug'] = '' !== $style['slug'] ? $style['slug'] : StyleSchema::slugify( $style['label'] );
		$replace       = 'replace' === $request->get_param( 'mode' ) && in_array( UserStyles::source( $style['slug'] ), array( 'yours', 'imported' ), true );

		if ( ! $replace ) {
			$free           = StyleSchema::free_slug( $style['slug'], $style['label'], UserStyles::taken() );
			$style['slug']  = $free['slug'];
			$style['label'] = $free['label'];
		}

		// Replacing keeps where the style came from; a new one is imported
		// unless it was made here.
		if ( $replace ) {
			$old    = $style['slug'];
			$stored = UserStyles::all()[ $old ];
			$source = UserStyles::source( $old );

			// A new name gets a slug to match (#138), so exports and class
			// names follow it; modals and the site default move with it.
			if ( (string) ( $stored['label'] ?? '' ) !== $style['label'] ) {
				$wanted = StyleSchema::slugify( $style['label'] );

				if ( '' !== $wanted && $wanted !== $old ) {
					$free           = StyleSchema::free_slug( $wanted, $style['label'], array_values( array_diff( UserStyles::taken(), array( $old ) ) ) );
					$style['slug']  = $free['slug'];
					$style['label'] = $free['label'];
				}
			}

			UserStyles::save( $style, $source, (string) ( $stored['from'] ?? '' ) );

			if ( $style['slug'] !== $old ) {
				UserStyles::reassign( $old, $style['slug'] );
				UserStyles::delete( $old );
			}
		} else {
			UserStyles::save( $style, 'yours' === $request->get_param( 'source' ) ? 'yours' : 'imported' );
		}

		return rest_ensure_response( $this->saved( $style['slug'], $read, $contrast ) );
	}

	/**
	 * Copies a style as a new one of yours.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response|WP_Error
	 */
	public function duplicate( WP_REST_Request $request ) {
		$slug  = (string) $request['slug'];
		$style = Styles::get( $slug );

		if ( ! $style ) {
			return new WP_Error( 'rest_not_found', __( 'There’s no style with that name.', 'modal-kit' ), array( 'status' => 404 ) );
		}

		$label = is_string( $request->get_param( 'label' ) ) && '' !== trim( $request->get_param( 'label' ) ) ? sanitize_text_field( $request->get_param( 'label' ) ) : $style['label'];
		$free  = StyleSchema::free_slug( StyleSchema::slugify( $label ), $label, UserStyles::taken() );
		$copy  = array_intersect_key( $style, array_flip( array( 'color', 'font', 'radius', 'shadow' ) ) ) + array(
			'slug'        => $free['slug'],
			'label'       => $free['label'],
			'description' => is_string( $request->get_param( 'description' ) ) ? sanitize_text_field( $request->get_param( 'description' ) ) : (string) ( $style['description'] ?? '' ),
			'version'     => 1,
		);

		UserStyles::save( $copy, 'yours', $slug );

		return rest_ensure_response( $this->saved( $copy['slug'] ) );
	}

	/**
	 * Deletes a style of yours, after switching the modals that use it.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return \WP_REST_Response|WP_Error
	 */
	public function delete( WP_REST_Request $request ) {
		$slug = (string) $request['slug'];

		if ( ! in_array( UserStyles::source( $slug ), array( 'yours', 'imported' ), true ) ) {
			return new WP_Error( 'modal_kit_style_builtin', __( 'Built-in styles can be exported and duplicated, not deleted.', 'modal-kit' ), array( 'status' => 400 ) );
		}

		$to   = (string) $request->get_param( 'reassign' );
		$used = UserStyles::modals_using( $slug );

		if ( $used && ( '' === $to || $to === $slug || ( ! in_array( $to, UserStyles::THEME, true ) && ! Styles::get( $to ) ) ) ) {
			return new WP_Error(
				'modal_kit_style_in_use',
				/* translators: %d: number of modals. */
				sprintf( _n( '%d modal uses this style. Choose the style it switches to.', '%d modals use this style. Choose the style they switch to.', count( $used ), 'modal-kit' ), count( $used ) ),
				array(
					'status' => 409,
					'usedBy' => count( $used ),
				)
			);
		}

		$changed = $used ? UserStyles::reassign( $slug, $to ) : 0;

		UserStyles::delete( $slug );

		return rest_ensure_response(
			array(
				'deleted'    => $slug,
				'reassigned' => $changed,
			)
		);
	}

	/**
	 * What the editor and Settings need after a save: the list row, the
	 * tile, the CSS rule to add to open pages, and the checks.
	 *
	 * @param string                    $slug     Saved slug.
	 * @param array<string, mixed>|null $read     StyleSchema::read() result.
	 * @param array<string, mixed>|null $contrast StyleSchema::contrast() result.
	 * @return array<string, mixed>
	 */
	private function saved( $slug, $read = null, $contrast = null ) {
		$style = (array) Styles::get( $slug );

		return array(
			'item'     => self::item( $slug ),
			'css'      => Styles::css( $style + array( 'slug' => $slug ) ),
			'missing'  => $read ? $read['missing'] : array(),
			'invalid'  => $read ? $read['invalid'] : array(),
			'ignored'  => $read ? $read['ignored'] : array(),
			'contrast' => $contrast,
			'fonts'    => Styles::missing_fonts( $style ),
		);
	}

	/**
	 * Downloads styles as a .zip: one JSON per style, and their bundled font
	 * files when asked (admin-post.php).
	 *
	 * @return void
	 */
	public function export_zip() {
		if ( ! $this->can_manage() ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to export styles.', 'modal-kit' ), 403 );
		}

		check_admin_referer( self::EXPORT_ACTION );

		$slugs = isset( $_GET['styles'] ) ? array_filter( array_map( 'sanitize_key', explode( ',', sanitize_text_field( wp_unslash( $_GET['styles'] ) ) ) ) ) : array();
		$fonts = ! empty( $_GET['fonts'] );

		if ( ! class_exists( '\ZipArchive' ) ) {
			wp_die( esc_html__( 'This server can’t make .zip files. Export the styles one at a time instead.', 'modal-kit' ) );
		}

		$file = wp_tempnam( 'modal-kit-styles' );
		$zip  = new \ZipArchive();
		$zip->open( $file, \ZipArchive::OVERWRITE );

		foreach ( $slugs as $slug ) {
			$style = Styles::get( $slug );

			if ( ! $style ) {
				continue;
			}

			$zip->addFromString( $slug . '.json', StyleSchema::export_json( $style + array( 'slug' => $slug ) ) );

			if ( $fonts ) {
				foreach ( Styles::font_files( $style ) as $font ) {
					$zip->addFile( Plugin::path( 'assets/fonts/' . $font ), 'fonts/' . $font );
				}
			}
		}

		$zip->close();

		nocache_headers();
		header( 'Content-Type: application/zip' );
		header( 'Content-Disposition: attachment; filename="modal-kit-styles.zip"' );
		header( 'Content-Length: ' . (string) filesize( $file ) );
		readfile( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- Streams the archive just built.
		wp_delete_file( $file );
		exit;
	}
}

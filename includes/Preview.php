<?php
/**
 * Live preview of the display defaults (mockup 5b).
 *
 * @package ModalKit
 */

namespace ModalKit;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * The Display tab shows a sample modal on the real front end, inside an
 * iframe, so the preview uses the theme's own fonts and colors. The request
 * is signed with a nonce and limited to users who can manage options.
 */
final class Preview {

	/**
	 * Query argument that asks for the preview.
	 */
	const ARG = 'modal_kit_preview';

	/**
	 * Nonce action.
	 */
	const NONCE = 'modal_kit_preview';

	/**
	 * Base preview URL; the app adds the display options as query args.
	 *
	 * @return string
	 */
	public static function url() {
		return add_query_arg(
			array(
				self::ARG  => 1,
				'_wpnonce' => wp_create_nonce( self::NONCE ),
			),
			home_url( '/' )
		);
	}

	/**
	 * Whether this request is a valid preview request.
	 *
	 * @return bool
	 */
	public static function is_request() {
		if ( ! isset( $_GET[ self::ARG ], $_GET['_wpnonce'] ) || ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		return (bool) wp_verify_nonce( sanitize_key( wp_unslash( $_GET['_wpnonce'] ) ), self::NONCE );
	}

	/**
	 * Modal block attributes from the query (sanitised by Layouts::resolve
	 * when rendered).
	 *
	 * @return array<string, mixed>
	 */
	public static function attributes() {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Checked in is_request().
		$get = static function ( $key, $fallback = '' ) {
			return isset( $_GET[ $key ] ) ? sanitize_text_field( wp_unslash( $_GET[ $key ] ) ) : $fallback;
		};

		$attributes = array(
			'modalLayout'  => sanitize_key( $get( 'layout', 'centered' ) ),
			'mobileLayout' => sanitize_key( $get( 'mobile', 'auto' ) ),
			'size'         => sanitize_key( $get( 'size', 'm' ) ),
			'animation'    => 'none',
			'overlay'      => array(
				'show'        => true,
				'color'       => sanitize_key( $get( 'overlayColor' ) ),
				'customColor' => Layouts::css_color( $get( 'overlayCustomColor' ) ),
				'opacity'     => (int) $get( 'overlayOpacity', '45' ),
				'blur'        => false,
			),
			'closeOptions' => array(
				'button'       => true,
				'esc'          => false,
				'outside'      => false,
				'visibleLabel' => '1' === $get( 'closeLabel' ),
			),
		);
		// phpcs:enable

		$style = sanitize_key( $get( 'style', 'default' ) );

		if ( in_array( $style, array( 'soft', 'editorial' ), true ) || Styles::get( $style ) ) {
			$attributes['className'] = 'is-style-' . $style;
		}

		if ( Styles::get( $style ) ) {
			$attributes['styleOptions'] = array(
				'accent'      => sanitize_key( $get( 'accent', 'style' ) ),
				'accentColor' => sanitize_hex_color( $get( 'accentColor' ) ),
				'fonts'       => sanitize_key( $get( 'fonts', 'style' ) ),
			);
		}

		return $attributes;
	}

	/**
	 * A sample modal that isn't stored anywhere.
	 *
	 * @return WP_Post
	 */
	public static function post() {
		$attributes = self::attributes();
		$heading    = '<!-- wp:heading --><h2 class="wp-block-heading">' . esc_html__( 'Preview', 'modal-kit' ) . '</h2><!-- /wp:heading -->';
		$style      = Styles::resolve( $attributes );
		$text       = $style['slug']
			/* translators: %s: style name, e.g. Harbor. */
			? sprintf( __( 'The %s style.', 'modal-kit' ), Styles::get( $style['slug'] )['label'] )
			: __( 'Your theme’s fonts and colors.', 'modal-kit' );
		$paragraph = '<!-- wp:paragraph --><p>' . esc_html( $text ) . '</p><!-- /wp:paragraph -->';
		$button    = '<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button">' . esc_html__( 'Button', 'modal-kit' ) . '</a></div><!-- /wp:button --></div><!-- /wp:buttons -->';
		$inner     = $heading . $paragraph . $button;

		if ( 'split' === $attributes['modalLayout'] ) {
			$inner = '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"></div><!-- /wp:group -->' . $inner;
		}

		return new WP_Post(
			(object) array(
				'ID'           => 0,
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_name'    => 'preview',
				'post_title'   => __( 'Preview', 'modal-kit' ),
				'post_content' => '<!-- wp:modal-kit/modal ' . wp_json_encode( $attributes ) . ' -->' . $inner . '<!-- /wp:modal-kit/modal -->',
				'filter'       => 'raw',
			)
		);
	}
}

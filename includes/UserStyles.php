<?php
/**
 * Your styles.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Imported and duplicated styles, stored as the same JSON as
 * src/styles/*.json plus description and version, in one non-autoloaded
 * option (#124). They are registered through `modal_kit_styles`, so they
 * render exactly like the built-in ones.
 */
final class UserStyles {

	/**
	 * Option holding the styles: slug => style (with `source` and `from`).
	 */
	const OPTION = 'modal_kit_user_styles';

	/**
	 * Slugs of the styles that follow the theme.
	 */
	const THEME = array( 'default', 'soft', 'editorial' );

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		// Early, so other plugins' styles can still override by slug.
		add_filter( 'modal_kit_styles', array( __CLASS__, 'register' ), 5 );
	}

	/**
	 * Every stored style.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function all() {
		$stored = get_option( self::OPTION, array() );

		return is_array( $stored ) ? array_filter( $stored, 'is_array' ) : array();
	}

	/**
	 * Adds the stored styles to the fixed styles.
	 *
	 * @param array<string, array<string, mixed>> $styles Styles by slug.
	 * @return array<string, array<string, mixed>>
	 */
	public static function register( $styles ) {
		foreach ( self::all() as $slug => $style ) {
			if ( ! isset( $styles[ $slug ] ) ) {
				$styles[ $slug ] = $style;
			}
		}

		return $styles;
	}

	/**
	 * Saves one style (replacing any with its slug).
	 *
	 * @param array<string, mixed> $style  Clean style with its slug.
	 * @param string               $source yours | imported.
	 * @param string               $from   Slug it was duplicated from.
	 * @return void
	 */
	public static function save( $style, $source, $from = '' ) {
		$all = self::all();

		$all[ $style['slug'] ] = $style + array(
			'source' => $source,
			'from'   => $from,
		);

		update_option( self::OPTION, $all, false );
		Styles::flush();
	}

	/**
	 * Removes one style.
	 *
	 * @param string $slug Slug.
	 * @return void
	 */
	public static function delete( $slug ) {
		$all = self::all();
		unset( $all[ $slug ] );

		update_option( self::OPTION, $all, false );
		Styles::flush();
	}

	/**
	 * Every slug in use, the styles that follow the theme included.
	 *
	 * @return string[]
	 */
	public static function taken() {
		return array_merge( self::THEME, array_keys( Styles::all() ) );
	}

	/**
	 * Where a style comes from: builtin, yours, imported or plugin.
	 *
	 * @param string $slug Slug.
	 * @return string
	 */
	public static function source( $slug ) {
		$style = Styles::get( $slug );

		if ( ! $style ) {
			return '';
		}

		if ( ! empty( $style['builtin'] ) ) {
			return 'builtin';
		}

		$stored = self::all()[ $slug ] ?? null;

		return $stored ? (string) ( $stored['source'] ?? 'yours' ) : 'plugin';
	}

	/**
	 * Modals whose block uses a style.
	 *
	 * @param string $slug Slug.
	 * @return int[] Post ids.
	 */
	public static function modals_using( $slug ) {
		global $wpdb;

		$like = '%' . $wpdb->esc_like( 'is-style-' . $slug ) . '%';
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT ID, post_content FROM {$wpdb->posts} WHERE post_type = %s AND post_status NOT IN ('trash','auto-draft','inherit') AND post_content LIKE %s", PostType::NAME, $like ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		$ids = array();

		foreach ( $rows as $row ) {
			if ( preg_match( self::pattern( $slug ), (string) $row->post_content ) ) {
				$ids[] = (int) $row->ID;
			}
		}

		return $ids;
	}

	/**
	 * The class of a style, not a longer slug that starts with it.
	 *
	 * @param string $slug Slug.
	 * @return string Regex.
	 */
	private static function pattern( $slug ) {
		return '/is-style-' . preg_quote( $slug, '/' ) . '(?![a-z0-9_-])/';
	}

	/**
	 * Switches every modal (and the site default) from one style to another
	 * before a style is deleted.
	 *
	 * @param string $from Style being deleted.
	 * @param string $to   Style they switch to ('default' for Native).
	 * @return int Modals changed.
	 */
	public static function reassign( $from, $to ) {
		$changed = 0;

		foreach ( self::modals_using( $from ) as $id ) {
			$post = get_post( $id );

			if ( ! $post ) {
				continue;
			}

			// Native is no class at all.
			$content = 'default' === $to
				? (string) preg_replace( '/ ?is-style-' . preg_quote( $from, '/' ) . '(?![a-z0-9_-])/', '', $post->post_content )
				: (string) preg_replace( self::pattern( $from ), 'is-style-' . $to, $post->post_content );

			// An empty className left behind in the block's attributes.
			$content = str_replace( array( ',"className":""', '"className":"",', '"className":""' ), array( '', '', '' ), $content );

			if ( $content !== $post->post_content ) {
				wp_update_post(
					array(
						'ID'           => $id,
						'post_content' => wp_slash( $content ),
					)
				);
				++$changed;
			}
		}

		$display = get_option( 'modal_kit_display', array() );

		if ( is_array( $display ) && ( $display['defaultStyle'] ?? '' ) === $from ) {
			$display['defaultStyle'] = $to;
			update_option( 'modal_kit_display', $display );
			Settings::flush();
		}

		return $changed;
	}
}

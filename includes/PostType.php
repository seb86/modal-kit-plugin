<?php
/**
 * The mk_modal post type.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the post type that stores modals.
 */
final class PostType {

	/**
	 * Post type name.
	 */
	const NAME = 'mk_modal';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'init', array( $this, 'register' ) );
	}

	/**
	 * Registers the post type.
	 *
	 * @return void
	 */
	public function register() {
		register_post_type(
			self::NAME,
			array(
				'labels'                => self::labels(),
				'description'           => __( 'Modals built from blocks.', 'modal-kit' ),
				'public'                => false,
				'publicly_queryable'    => false,
				'exclude_from_search'   => true,
				'show_ui'               => true,
				'show_in_menu'          => true,
				'show_in_nav_menus'     => false,
				'show_in_admin_bar'     => true,
				'show_in_rest'          => true,
				'rest_controller_class' => Rest\Modals::class,
				'menu_position'         => 21,
				'menu_icon'             => self::menu_icon(),
				'capability_type'       => array( 'mk_modal', 'mk_modals' ),
				'capabilities'          => self::capabilities(),
				'map_meta_cap'          => true,
				'hierarchical'          => false,
				'has_archive'           => false,
				'rewrite'               => false,
				'query_var'             => false,
				'can_export'            => true,
				'delete_with_user'      => false,
				'supports'              => array( 'title', 'editor', 'revisions', 'custom-fields' ),
				// The Modal block is the only root block; its inner blocks stay unlocked.
				'template_lock'         => 'insert',
				'template'              => array(
					array( 'modal-kit/modal', self::template_attributes() ),
				),
			)
		);
	}

	/**
	 * Attributes of the Modal block in a new modal: locked, with the defaults
	 * from Settings → Display.
	 *
	 * @return array<string, mixed>
	 */
	public static function template_attributes() {
		$display = Settings::get( 'display' );

		$attributes = array(
			'lock'         => array(
				'move'   => true,
				'remove' => true,
			),
			'modalLayout'  => $display['defaultLayout'],
			'mobileLayout' => $display['defaultMobile'],
			'size'         => $display['defaultSize'],
			'overlay'      => array(
				'show'        => true,
				'color'       => $display['overlayColor'],
				'customColor' => $display['overlayCustomColor'],
				'opacity'     => $display['overlayOpacity'],
				'blur'        => false,
			),
			'closeOptions' => array(
				'button'       => true,
				'esc'          => true,
				'outside'      => true,
				'visibleLabel' => $display['closeLabelVisible'],
			),
			'animation'    => $display['animation'],
		);

		$style = (string) $display['defaultStyle'];

		if ( in_array( $style, array( 'soft', 'editorial' ), true ) || Styles::get( $style ) ) {
			$attributes['className'] = 'is-style-' . $style;
		}

		if ( Styles::get( $style ) ) {
			$attributes['styleOptions'] = array(
				'accent'      => $display['defaultAccent'],
				'accentColor' => $display['defaultAccentColor'],
				'fonts'       => $display['defaultFonts'],
			);
		}

		return $attributes;
	}

	/**
	 * Post type labels.
	 *
	 * @return array<string, string>
	 */
	public static function labels() {
		return array(
			'name'                   => _x( 'Modals', 'post type general name', 'modal-kit' ),
			'singular_name'          => _x( 'Modal', 'post type singular name', 'modal-kit' ),
			'menu_name'              => _x( 'Modal Kit', 'admin menu', 'modal-kit' ),
			'name_admin_bar'         => _x( 'Modal', 'add new on admin bar', 'modal-kit' ),
			'add_new'                => __( 'Add New Modal', 'modal-kit' ),
			'add_new_item'           => __( 'Add New Modal', 'modal-kit' ),
			'new_item'               => __( 'New Modal', 'modal-kit' ),
			'edit_item'              => __( 'Edit Modal', 'modal-kit' ),
			'view_item'              => __( 'View Modal', 'modal-kit' ),
			'all_items'              => __( 'All Modals', 'modal-kit' ),
			'search_items'           => __( 'Search Modals', 'modal-kit' ),
			'not_found'              => __( 'No modals found.', 'modal-kit' ),
			'not_found_in_trash'     => __( 'No modals found in Trash.', 'modal-kit' ),
			'item_published'         => __( 'Modal published.', 'modal-kit' ),
			'item_updated'           => __( 'Modal updated.', 'modal-kit' ),
			'item_scheduled'         => __( 'Modal scheduled.', 'modal-kit' ),
			'item_reverted_to_draft' => __( 'Modal reverted to draft.', 'modal-kit' ),
			'filter_items_list'      => __( 'Filter modals list', 'modal-kit' ),
			'items_list_navigation'  => __( 'Modals list navigation', 'modal-kit' ),
			'items_list'             => __( 'Modals list', 'modal-kit' ),
		);
	}

	/**
	 * Primitive capabilities, each mapped to its post equivalent so modals
	 * follow the same role rules as posts, except for going live. A published
	 * modal can show on every page of the site, so publishing one, or changing
	 * or deleting one that's live, takes what changing other people's posts
	 * takes: Authors and Contributors draft, and Editors publish.
	 *
	 * @return array<string, string>
	 */
	public static function capabilities() {
		$caps = array(
			'edit_posts'             => 'edit_posts',
			'edit_others_posts'      => 'edit_others_posts',
			'edit_private_posts'     => 'edit_private_posts',
			'edit_published_posts'   => 'edit_others_posts',
			'publish_posts'          => 'edit_others_posts',
			'read_private_posts'     => 'read_private_posts',
			'delete_posts'           => 'delete_posts',
			'delete_others_posts'    => 'delete_others_posts',
			'delete_private_posts'   => 'delete_private_posts',
			'delete_published_posts' => 'delete_others_posts',
			'create_posts'           => 'edit_posts',
			'read'                   => 'read',
		);

		/**
		 * Filters the capabilities required to manage modals.
		 *
		 * @param array<string, string> $caps Post type capability => required capability.
		 */
		return (array) apply_filters( 'modal_kit_post_type_capabilities', $caps );
	}

	/**
	 * The Modal Kit mark as an admin menu icon. Single fill so the admin
	 * color scheme can tint it.
	 *
	 * @return string
	 */
	public static function menu_icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="black" fill-rule="evenodd" d="M14 0h20a14 14 0 0 1 14 14v20a14 14 0 0 1-14 14H14A14 14 0 0 1 0 34V14A14 14 0 0 1 14 0Zm0 5a9 9 0 0 0-9 9v20a9 9 0 0 0 9 9h20a9 9 0 0 0 9-9V14a9 9 0 0 0-9-9Zm1 10h18a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V19a4 4 0 0 1 4-4Z"/></svg>';

		return 'data:image/svg+xml;base64,' . base64_encode( $svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Data URI for the menu icon.
	}
}

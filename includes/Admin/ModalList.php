<?php
/**
 * The modal list screen.
 *
 * @package ModalKit
 */

namespace ModalKit\Admin;

use ModalKit\Layouts;
use ModalKit\Meta;
use ModalKit\Plugin;
use ModalKit\PostType;
use ModalKit\Render;
use ModalKit\Rules;
use WP_Post;
use WP_Query;

defined( 'ABSPATH' ) || exit;

/**
 * Columns (Layout, Triggers, Shows on, On / off, Modified), row actions
 * (Duplicate, Copy link), and the Active / Scheduled views of the standard
 * list table.
 */
final class ModalList {

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		$type = PostType::NAME;

		add_filter( "manage_{$type}_posts_columns", array( $this, 'columns' ) );
		add_action( "manage_{$type}_posts_custom_column", array( $this, 'column' ), 10, 2 );
		add_filter( "manage_edit-{$type}_sortable_columns", array( $this, 'sortable' ) );
		add_filter( 'post_row_actions', array( $this, 'row_actions' ), 10, 2 );
		add_filter( "views_edit-{$type}", array( $this, 'views' ) );
		add_action( 'pre_get_posts', array( $this, 'filter_view' ) );
		add_filter( 'display_post_states', array( $this, 'post_states' ), 10, 2 );
		add_action( 'admin_post_modal_kit_duplicate', array( $this, 'duplicate' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Column list.
	 *
	 * @param array<string, string> $columns Default columns.
	 * @return array<string, string>
	 */
	public function columns( $columns ) {
		return array(
			'cb'                 => $columns['cb'],
			'title'              => __( 'Title', 'modal-kit' ),
			'modal_kit_layout'   => __( 'Layout', 'modal-kit' ),
			'modal_kit_triggers' => __( 'Triggers', 'modal-kit' ),
			'modal_kit_shows_on' => __( 'Shows on', 'modal-kit' ),
			'modal_kit_enabled'  => __( 'On / off', 'modal-kit' ),
			'modal_kit_modified' => __( 'Modified', 'modal-kit' ),
		);
	}

	/**
	 * Sortable columns.
	 *
	 * @param array<string, string> $columns Sortable columns.
	 * @return array<string, string>
	 */
	public function sortable( $columns ) {
		$columns['modal_kit_modified'] = 'modified';

		return $columns;
	}

	/**
	 * Prints one cell.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Modal ID.
	 * @return void
	 */
	public function column( $column, $post_id ) {
		$post = get_post( $post_id );

		if ( ! $post ) {
			return;
		}

		switch ( $column ) {
			case 'modal_kit_layout':
				echo esc_html( self::layout_label( $post ) );
				break;

			case 'modal_kit_triggers':
				echo esc_html( self::triggers_summary( $post ) );
				break;

			case 'modal_kit_shows_on':
				echo esc_html( self::shows_on_summary( $post ) );
				break;

			case 'modal_kit_enabled':
				$enabled = (bool) Meta::get( $post_id, 'enabled' );
				printf(
					'<button type="button" class="modal-kit-switch" role="switch" aria-checked="%1$s" data-id="%2$d" aria-label="%3$s"%4$s><span class="modal-kit-switch__track" aria-hidden="true"></span></button>',
					$enabled ? 'true' : 'false',
					(int) $post_id,
					/* translators: %s: modal title. */
					esc_attr( sprintf( __( 'Show “%s” on the site', 'modal-kit' ), get_the_title( $post ) ) ),
					current_user_can( 'edit_post', $post_id ) ? '' : ' disabled'
				);
				break;

			case 'modal_kit_modified':
				echo esc_html( get_the_modified_date( '', $post ) );
				break;
		}
	}

	/**
	 * The modal's layout name.
	 *
	 * @param WP_Post $post Modal.
	 * @return string
	 */
	public static function layout_label( WP_Post $post ) {
		$block  = Render::find_modal_block( parse_blocks( $post->post_content ) );
		$layout = Layouts::resolve( $block ? $block['attrs'] : array() )['layout'];
		$labels = array(
			'centered' => __( 'Centered', 'modal-kit' ),
			'corner'   => __( 'Corner', 'modal-kit' ),
			'bar'      => __( 'Bar', 'modal-kit' ),
			'full'     => __( 'Full-screen', 'modal-kit' ),
			'drawer'   => __( 'Drawer', 'modal-kit' ),
			'split'    => __( 'Split', 'modal-kit' ),
			'sheet'    => __( 'Sheet', 'modal-kit' ),
			'inline'   => __( 'Inline', 'modal-kit' ),
			'video'    => __( 'Video', 'modal-kit' ),
		);

		if ( isset( $labels[ $layout ] ) ) {
			return $labels[ $layout ];
		}

		// Add-on layouts (modal_kit_layouts) bring their own label.
		$def = Layouts::get( $layout );

		return isset( $def['label'] ) ? (string) $def['label'] : ucfirst( $layout );
	}

	/**
	 * Trigger summary, e.g. "Scroll 50%, Leaving the page".
	 *
	 * @param WP_Post $post Modal.
	 * @return string
	 */
	public static function triggers_summary( WP_Post $post ) {
		$parts = array();

		foreach ( (array) Meta::get( $post->ID, 'triggers' ) as $trigger ) {
			switch ( $trigger['type'] ) {
				case 'load':
					$parts[] = empty( $trigger['delay'] )
						? __( 'Page load', 'modal-kit' )
						/* translators: %d: seconds. */
						: sprintf( __( 'Page load + %ds', 'modal-kit' ), $trigger['delay'] );
					break;
				case 'scroll':
					/* translators: %d: percent. */
					$parts[] = sprintf( __( 'Scroll %d%%', 'modal-kit' ), isset( $trigger['percent'] ) ? $trigger['percent'] : 50 );
					break;
				case 'exit':
					$parts[] = __( 'Leaving the page', 'modal-kit' );
					break;
				case 'time':
					/* translators: %d: seconds. */
					$parts[] = sprintf( __( 'Time on site %ds', 'modal-kit' ), isset( $trigger['delay'] ) ? $trigger['delay'] : 30 );
					break;
				case 'inactivity':
					/* translators: %d: seconds. */
					$parts[] = sprintf( __( 'Inactivity %ds', 'modal-kit' ), isset( $trigger['delay'] ) ? $trigger['delay'] : 30 );
					break;
				case 'url':
					/* translators: %s: query or hash. */
					$parts[] = sprintf( __( 'URL %s', 'modal-kit' ), isset( $trigger['value'] ) ? $trigger['value'] : '' );
					break;
				case 'element':
					/* translators: %s: element anchor. */
					$parts[] = sprintf( __( 'Element in view #%s', 'modal-kit' ), isset( $trigger['anchor'] ) ? $trigger['anchor'] : '' );
					break;
			}
		}

		// Link clicks always work.
		/* translators: %s: link anchor, e.g. #modal-hours. */
		$parts[] = sprintf( __( 'Click #%s', 'modal-kit' ), Render::dom_id( $post ) );

		return implode( ', ', $parts );
	}

	/**
	 * Targeting summary, e.g. "/shop/*, Home".
	 *
	 * @param WP_Post $post Modal.
	 * @return string
	 */
	public static function shows_on_summary( WP_Post $post ) {
		$show_on = Meta::get( $post->ID, 'rules' )['showOn'];
		$name    = static function ( $entry ) {
			$entry = trim( (string) $entry );

			if ( '/' === $entry ) {
				return __( 'Home', 'modal-kit' );
			}

			if ( preg_match( '/^post:(\d+)$/', $entry, $match ) ) {
				$id = (int) $match[1];

				if ( get_post( $id ) && ! is_post_publicly_viewable( $id ) && ! current_user_can( 'read_post', $id ) ) {
					return __( '(private page)', 'modal-kit' );
				}

				$title = get_the_title( $id );
				return '' !== $title ? $title : __( '(deleted page)', 'modal-kit' );
			}

			return $entry;
		};
		$exclude = 'exclude' === $show_on['mode'] || Rules::exceptions_apply( $show_on )
			? array_map( $name, array_filter( (array) $show_on['exclude'] ) )
			: array();

		if ( 'include' !== $show_on['mode'] ) {
			$text = __( 'Entire site', 'modal-kit' );
		} else {
			$places = array_map( $name, array_filter( (array) $show_on['include'] ) );

			foreach ( array_filter( (array) $show_on['postTypes'] ) as $type ) {
				$object = get_post_type_object( $type );
				if ( $object ) {
					$places[] = $object->labels->name;
				}
			}

			$text = $places ? implode( ', ', $places ) : __( 'No pages yet', 'modal-kit' );
		}

		if ( $exclude ) {
			/* translators: 1: where it shows, 2: excluded paths. */
			$text = sprintf( __( '%1$s, except %2$s', 'modal-kit' ), $text, implode( ', ', $exclude ) );
		}

		return $text;
	}

	/**
	 * Row actions: Edit | Duplicate | Copy link #slug | Trash.
	 *
	 * @param array<string, string> $actions Actions.
	 * @param WP_Post               $post    Post.
	 * @return array<string, string>
	 */
	public function row_actions( $actions, $post ) {
		if ( PostType::NAME !== $post->post_type ) {
			return $actions;
		}

		unset( $actions['inline hide-if-no-js'], $actions['view'] );

		$ordered = array();

		if ( isset( $actions['edit'] ) ) {
			$ordered['edit'] = $actions['edit'];
		}

		if ( current_user_can( 'edit_posts' ) ) {
			$url = wp_nonce_url(
				admin_url( 'admin-post.php?action=modal_kit_duplicate&post=' . $post->ID ),
				'modal_kit_duplicate_' . $post->ID
			);

			$ordered['duplicate'] = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Duplicate', 'modal-kit' ) . '</a>';
		}

		if ( 'publish' === $post->post_status ) {
			$anchor = '#' . Render::dom_id( $post );

			$ordered['copy_link'] = sprintf(
				'<button type="button" class="button-link modal-kit-copy-link" data-copy="%1$s">%2$s <code>%3$s</code></button>',
				esc_attr( $anchor ),
				esc_html__( 'Copy link', 'modal-kit' ),
				esc_html( $anchor )
			);
		}

		return array_merge( $ordered, array_diff_key( $actions, $ordered ) );
	}

	/**
	 * "Scheduled · starts Oct 20" under the title.
	 *
	 * @param array<string, string> $states States.
	 * @param WP_Post               $post   Post.
	 * @return array<string, string>
	 */
	public function post_states( $states, $post ) {
		if ( PostType::NAME !== $post->post_type || 'publish' !== $post->post_status ) {
			return $states;
		}

		$start = strtotime( (string) Meta::get( $post->ID, 'rules' )['schedule']['start'] );

		if ( $start && $start > time() ) {
			/* translators: %s: start date. */
			$states['modal_kit_scheduled'] = sprintf( __( 'Scheduled · starts %s', 'modal-kit' ), wp_date( get_option( 'date_format' ), $start ) );
		}

		if ( ! Meta::get( $post->ID, 'enabled' ) ) {
			$states['modal_kit_off'] = __( 'Off', 'modal-kit' );
		}

		return $states;
	}

	/**
	 * IDs of published modals in the Active or Scheduled view.
	 *
	 * @param string $view active | scheduled.
	 * @return int[]
	 */
	public static function ids_for_view( $view ) {
		$ids = get_posts(
			array(
				'post_type'      => PostType::NAME,
				'post_status'    => 'publish',
				'posts_per_page' => 500, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- Admin only; sites have a handful of modals.
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);

		$now = time();

		return array_values(
			array_filter(
				array_map( 'intval', $ids ),
				static function ( $id ) use ( $view, $now ) {
					$schedule  = Meta::get( $id, 'rules' )['schedule'];
					$start     = strtotime( (string) $schedule['start'] );
					$end       = strtotime( (string) $schedule['end'] );
					$scheduled = $start && $start > $now;

					if ( 'scheduled' === $view ) {
						return $scheduled;
					}

					return Meta::get( $id, 'enabled' ) && ! $scheduled && ! ( $end && $end < $now );
				}
			)
		);
	}

	/**
	 * Views: All | Active | Scheduled | Draft.
	 *
	 * @param array<string, string> $views Views.
	 * @return array<string, string>
	 */
	public function views( $views ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only view switch.
		$current = isset( $_GET['modal_kit_view'] ) ? sanitize_key( wp_unslash( $_GET['modal_kit_view'] ) ) : '';
		$base    = admin_url( 'edit.php?post_type=' . PostType::NAME );
		$ours    = array();

		foreach (
			array(
				/* translators: %s: count. */
				'active'    => _n_noop( 'Active <span class="count">(%s)</span>', 'Active <span class="count">(%s)</span>', 'modal-kit' ),
				/* translators: %s: count. */
				'scheduled' => _n_noop( 'Scheduled <span class="count">(%s)</span>', 'Scheduled <span class="count">(%s)</span>', 'modal-kit' ),
			) as $view => $label
		) {
			$count         = count( self::ids_for_view( $view ) );
			$ours[ $view ] = sprintf(
				'<a href="%1$s"%2$s>%3$s</a>',
				esc_url( add_query_arg( 'modal_kit_view', $view, $base ) ),
				$current === $view ? ' class="current" aria-current="page"' : '',
				sprintf( translate_nooped_plural( $label, $count, 'modal-kit' ), number_format_i18n( $count ) )
			);
		}

		// When one of ours is current, "All" isn't.
		if ( $current && isset( $views['all'] ) ) {
			$views['all'] = str_replace( array( ' class="current"', ' aria-current="page"' ), '', $views['all'] );
		}

		unset( $views['publish'] );

		$all = isset( $views['all'] ) ? array( 'all' => $views['all'] ) : array();

		return array_merge( $all, $ours, array_diff_key( $views, $all ) );
	}

	/**
	 * Applies the Active / Scheduled views.
	 *
	 * @param WP_Query $query Query.
	 * @return void
	 */
	public function filter_view( $query ) {
		if ( ! is_admin() || ! $query->is_main_query() || PostType::NAME !== $query->get( 'post_type' ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only view switch.
		$view = isset( $_GET['modal_kit_view'] ) ? sanitize_key( wp_unslash( $_GET['modal_kit_view'] ) ) : '';

		if ( in_array( $view, array( 'active', 'scheduled' ), true ) ) {
			$ids = self::ids_for_view( $view );
			$query->set( 'post_status', 'publish' );
			$query->set( 'post__in', $ids ? $ids : array( 0 ) );
		}
	}

	/**
	 * Duplicates a modal as a draft, with its triggers, rules and overrides.
	 *
	 * @return void
	 */
	public function duplicate() {
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;

		check_admin_referer( 'modal_kit_duplicate_' . $post_id );

		$post = get_post( $post_id );

		if ( ! $post || PostType::NAME !== $post->post_type || ! current_user_can( 'edit_post', $post_id ) || ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( 'You can’t duplicate this modal.', 'modal-kit' ), 403 );
		}

		$copy = wp_insert_post(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'draft',
				/* translators: %s: modal title. */
				'post_title'   => sprintf( __( '%s (copy)', 'modal-kit' ), $post->post_title ),
				'post_content' => wp_slash( $post->post_content ),
				'menu_order'   => $post->menu_order,
			),
			true
		);

		if ( is_wp_error( $copy ) ) {
			wp_die( esc_html( $copy->get_error_message() ) );
		}

		foreach ( Meta::KEYS as $key ) {
			if ( metadata_exists( 'post', $post_id, Meta::PREFIX . $key ) ) {
				update_post_meta( $copy, Meta::PREFIX . $key, wp_slash( get_post_meta( $post_id, Meta::PREFIX . $key, true ) ) );
			}
		}

		wp_safe_redirect( (string) get_edit_post_link( $copy, 'url' ) );
		exit;
	}

	/**
	 * Script for the On / off switches and Copy link buttons.
	 *
	 * @param string $hook Admin page hook.
	 * @return void
	 */
	public function enqueue( $hook ) {
		$screen = get_current_screen();

		if ( 'edit.php' !== $hook || ! $screen || PostType::NAME !== $screen->post_type ) {
			return;
		}

		$asset_file = Plugin::path( 'build/admin/list.asset.php' );

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script( 'modal-kit-list', Plugin::url( 'build/admin/list.js' ), $asset['dependencies'], $asset['version'], true );
		wp_enqueue_style( 'modal-kit-list', Plugin::url( 'build/admin/style-list.css' ), array(), $asset['version'] );
		wp_set_script_translations( 'modal-kit-list', 'modal-kit', Plugin::path( 'languages' ) );
	}
}

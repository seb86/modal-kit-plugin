<?php
/**
 * Modals in the editor's link search (mockup 1g).
 *
 * @package ModalKit
 */

namespace ModalKit\Rest;

use ModalKit\PostType;
use ModalKit\Render;
use WP_REST_Post_Search_Handler;
use WP_REST_Request;
use WP_REST_Search_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * The core post search handler, plus modals for users who can edit them.
 * A modal result's URL is its anchor (#modal-slug), so choosing it in the
 * link popover writes a normal link that opens the modal.
 */
class Search extends WP_REST_Post_Search_Handler {

	/**
	 * Adds the modal post type to the searchable subtypes. Who may see them
	 * is checked per search.
	 */
	public function __construct() {
		parent::__construct();

		$this->subtypes[] = PostType::NAME;
	}

	/**
	 * Swaps the core post handler for this one.
	 *
	 * @param array<int, object> $handlers Search handlers.
	 * @return array<int, object>
	 */
	public static function register( $handlers ) {
		foreach ( $handlers as $index => $handler ) {
			if ( get_class( $handler ) === WP_REST_Post_Search_Handler::class ) {
				$handlers[ $index ] = new self();
			}
		}

		return $handlers;
	}

	/**
	 * Searches posts; modals are only included for users who can edit them.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, mixed>
	 */
	public function search_items( WP_REST_Request $request ) {
		$all = $this->subtypes;

		if ( ! current_user_can( 'edit_posts' ) ) {
			$this->subtypes = array_values( array_diff( $all, array( PostType::NAME ) ) );

			// Asking for modals explicitly doesn't get around it.
			$requested = array_values( array_diff( (array) $request[ WP_REST_Search_Controller::PROP_SUBTYPE ], array( PostType::NAME ) ) );

			if ( ! $requested ) {
				$this->subtypes = $all;

				return array(
					self::RESULT_IDS   => array(),
					self::RESULT_TOTAL => 0,
				);
			}

			$request->set_param( WP_REST_Search_Controller::PROP_SUBTYPE, $requested );
		}

		$result         = parent::search_items( $request );
		$this->subtypes = $all;

		return $result;
	}

	/**
	 * Prepares a result. Modals link to their anchor and are labelled
	 * "modal" in the link popover (it shows the subtype as the type).
	 *
	 * Searching still filters on the real post type; only the result's
	 * label changes.
	 *
	 * @param int                $id     Post ID.
	 * @param array<int, string> $fields Requested fields.
	 * @return array<string, mixed>
	 */
	public function prepare_item( $id, array $fields ) {
		$data = parent::prepare_item( $id, $fields );
		$post = get_post( $id );

		if ( $post && PostType::NAME === $post->post_type ) {
			if ( in_array( 'url', $fields, true ) ) {
				$data['url'] = '#' . Render::dom_id( $post );
			}

			if ( in_array( 'subtype', $fields, true ) ) {
				$data['subtype'] = 'modal';
			}
		}

		return $data;
	}
}

<?php
/**
 * The modal post type's REST controller.
 *
 * @package ModalKit
 */

namespace ModalKit\Rest;

use WP_Error;
use WP_REST_Posts_Controller;
use WP_REST_Request;

defined( 'ABSPATH' ) || exit;

/**
 * Modals are printed only where their rules allow, so the standard routes
 * mustn't hand a published one, with its rules, to anyone who asks. Only people
 * who can write modals can read them here. Showing a modal never needs these
 * routes.
 */
final class Modals extends WP_REST_Posts_Controller {

	/**
	 * Whether the current user may read modals.
	 *
	 * @return true|WP_Error
	 */
	private function can_read() {
		$type = get_post_type_object( $this->post_type );

		if ( $type && current_user_can( $type->cap->edit_posts ) ) {
			return true;
		}

		return new WP_Error(
			'modal_kit_rest_cannot_read',
			__( 'Sorry, you are not allowed to view modals.', 'modal-kit' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}

	/**
	 * Checks if a request may read the list.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public function get_items_permissions_check( $request ) {
		$allowed = $this->can_read();

		return is_wp_error( $allowed ) ? $allowed : parent::get_items_permissions_check( $request );
	}

	/**
	 * Checks if a request may read one modal.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public function get_item_permissions_check( $request ) {
		$allowed = $this->can_read();

		return is_wp_error( $allowed ) ? $allowed : parent::get_item_permissions_check( $request );
	}
}

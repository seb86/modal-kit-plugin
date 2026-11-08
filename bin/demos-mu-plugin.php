<?php
/**
 * Plugin Name: Modal Kit demos
 * Description: Lifts the automatic-open limit and the cool-down (Settings → General) on demo pages marked for it. Installed on the local dev site by `npm run demos`.
 * Author: Sébastien Dumont
 *
 * @package ModalKit
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'script_module_data_@wordpress/interactivity',
	static function ( $data ) {
		if ( isset( $data['state']['modal-kit'] ) && is_singular() && get_post_meta( get_queried_object_id(), '_modal_kit_demo_unlimited', true ) ) {
			$data['state']['modal-kit']['autoOpenLimit'] = 0;
			$data['state']['modal-kit']['cooldown']      = 0;
		}

		return $data;
	},
	20
);

<?php
/**
 * Seeds the content the static-export suite checks (run with `wp eval-file`).
 * Removes the previous fixtures first. Prints the created page paths as JSON.
 *
 * @package ModalKit
 */

defined( 'ABSPATH' ) || exit;

$modal_kit_old = get_posts(
	array(
		'post_type'      => array( 'page', 'mk_modal' ),
		'post_status'    => 'any',
		'posts_per_page' => -1,
		'meta_key'       => '_modal_kit_static_fixture', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		'fields'         => 'ids',
	)
);

foreach ( $modal_kit_old as $modal_kit_id ) {
	wp_delete_post( $modal_kit_id, true );
}

$modal_kit_inner = '<!-- wp:heading --><h2 class="wp-block-heading">Static sale</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Works on an exported site.</p><!-- /wp:paragraph --><!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button {"modalKitAction":"close"} --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button">No thanks</a></div><!-- /wp:button --></div><!-- /wp:buttons -->';

$modal_kit_modals = array(
	'static-link'   => array(),
	'static-scroll' => array(
		'_modal_kit_triggers' => array(
			array(
				'type'    => 'scroll',
				'percent' => 40,
			),
		),
	),
	'static-shop'   => array(
		'_modal_kit_triggers' => array(
			array(
				'type'  => 'load',
				'delay' => 0,
			),
		),
		'_modal_kit_rules'    => array(
			'showOn'    => array(
				'mode'    => 'include',
				'include' => array( '/static-shop/' ),
			),
			'frequency' => array(
				'mode' => 'days',
				'days' => 7,
			),
		),
	),
	// A fixed style: its bundled fonts must load from the export.
	'static-styled' => array(
		'_modal_kit_triggers' => array(
			array(
				'type'  => 'load',
				'delay' => 0,
			),
		),
		'_modal_kit_rules'    => array(
			'showOn' => array(
				'mode'    => 'include',
				'include' => array( '/static-styled/' ),
			),
		),
	),
);

// Modal block attributes besides the lock.
$modal_kit_attributes = array(
	'static-styled' => array( 'className' => 'is-style-harbor' ),
);

foreach ( $modal_kit_modals as $modal_kit_slug => $modal_kit_meta ) {
	$modal_kit_block = array_merge(
		array(
			'lock' => array(
				'move'   => true,
				'remove' => true,
			),
		),
		isset( $modal_kit_attributes[ $modal_kit_slug ] ) ? $modal_kit_attributes[ $modal_kit_slug ] : array()
	);
	$modal_kit_id    = wp_insert_post(
		array(
			'post_type'    => 'mk_modal',
			'post_status'  => 'publish',
			'post_name'    => $modal_kit_slug,
			'post_title'   => $modal_kit_slug,
			'post_content' => '<!-- wp:modal-kit/modal ' . wp_json_encode( $modal_kit_block ) . ' -->' . $modal_kit_inner . '<!-- /wp:modal-kit/modal -->',
		)
	);

	update_post_meta( $modal_kit_id, '_modal_kit_static_fixture', 1 );

	foreach ( $modal_kit_meta as $modal_kit_key => $modal_kit_value ) {
		update_post_meta( $modal_kit_id, $modal_kit_key, $modal_kit_value );
	}
}

$modal_kit_filler = str_repeat( '<!-- wp:paragraph --><p>Paper, pens and the notebooks we make.</p><!-- /wp:paragraph -->', 40 );
$modal_kit_pages  = array(
	'static-home'   => '<!-- wp:paragraph --><p><a href="#modal-static-link">Open the modal</a></p><!-- /wp:paragraph -->' . $modal_kit_filler,
	'static-shop'   => '<!-- wp:paragraph --><p>The shop.</p><!-- /wp:paragraph -->',
	'static-styled' => '<!-- wp:paragraph --><p>A styled modal.</p><!-- /wp:paragraph -->',
);
$modal_kit_paths  = array();

foreach ( $modal_kit_pages as $modal_kit_slug => $modal_kit_content ) {
	$modal_kit_id = wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_name'    => $modal_kit_slug,
			'post_title'   => $modal_kit_slug,
			'post_content' => $modal_kit_content,
		)
	);

	update_post_meta( $modal_kit_id, '_modal_kit_static_fixture', 1 );
	$modal_kit_paths[ $modal_kit_slug ] = (string) wp_parse_url( get_permalink( $modal_kit_id ), PHP_URL_PATH );
}

echo wp_json_encode( $modal_kit_paths );

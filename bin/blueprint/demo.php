<?php
/**
 * Demo content for the WordPress.org "Live Preview" (Playground): every free
 * starter as a published modal, and a front page with a button for each.
 * The Shipping notice bar opens on its own; the rest open from their button.
 *
 * Embedded as the blueprint's runPHP step by `npm run wporg:blueprint`
 * (bin/blueprint.mjs). Not part of the plugin.
 *
 * @package ModalKit
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals -- A Playground script, not plugin code.

require '/wordpress/wp-load.php';

wp_set_current_user( 1 );

// The preview starts with demo modals, so skip the first-run redirect.
delete_transient( 'modal_kit_wizard_redirect' );
update_option( 'modal_kit_wizard_done', time(), false );

$defaults = \ModalKit\Meta::schema( 'rules' )['default'];
$settings = \ModalKit\Patterns::starter_settings();
$page_id  = wp_insert_post(
	array(
		'post_type'   => 'page',
		'post_status' => 'publish',
		'post_title'  => 'Modal Kit',
		'post_name'   => 'modal-kit',
	)
);
$buttons  = array();

foreach ( WP_Block_Patterns_Registry::get_instance()->get_all_registered() as $pattern ) {
	if ( 0 !== strpos( $pattern['name'], 'modal-kit/' ) ) {
		continue;
	}

	$slug  = substr( $pattern['name'], strlen( 'modal-kit/' ) );
	$own   = isset( $settings[ $pattern['name'] ] ) ? $settings[ $pattern['name'] ] : array();
	$rules = \ModalKit\Meta::merge_defaults( isset( $own['rules'] ) ? $own['rules'] : array(), $defaults );

	// Only on the demo page, and links always open it.
	$rules['showOn']['mode']    = 'include';
	$rules['showOn']['include'] = array( 'post:' . $page_id );

	$modal_id = wp_insert_post(
		array(
			'post_type'    => \ModalKit\PostType::NAME,
			'post_status'  => 'publish',
			'post_title'   => $pattern['title'],
			'post_name'    => $slug,
			'post_content' => $pattern['content'],
		)
	);

	update_post_meta(
		$modal_id,
		'_modal_kit_triggers',
		'shipping-notice' === $slug ? array(
			array(
				'type'  => 'load',
				'delay' => 1,
			),
		) : array()
	);
	update_post_meta( $modal_id, '_modal_kit_rules', $rules );

	$buttons[ $pattern['title'] ] = '<!-- wp:button {"className":"is-style-outline"} --><div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="#modal-' . esc_attr( $slug ) . '">' . esc_html( $pattern['title'] ) . '</a></div><!-- /wp:button -->';
}

ksort( $buttons );

// The theme prints the page title.
$content = '<!-- wp:paragraph --><p>Modals and popups built from core blocks, in your theme’s colors, fonts and spacing. Each button opens one of the starter templates: try them on a phone-sized window too.</p><!-- /wp:paragraph -->'
	. '<!-- wp:buttons --><div class="wp-block-buttons">' . implode( '', $buttons ) . '</div><!-- /wp:buttons -->'
	. '<!-- wp:paragraph --><p>To edit them, or to start a new one from a starter, go to <a href="' . esc_url( admin_url( 'edit.php?post_type=' . \ModalKit\PostType::NAME ) ) . '">Modal Kit → All Modals</a>. <a href="' . esc_url( admin_url( 'edit.php?post_type=' . \ModalKit\PostType::NAME . '&page=modal-kit-settings' ) ) . '">Settings</a> holds the site-wide defaults and styles.</p><!-- /wp:paragraph -->';

wp_update_post(
	array(
		'ID'           => $page_id,
		'post_content' => $content,
	)
);

update_option( 'blogname', 'Modal Kit demo' );
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $page_id );

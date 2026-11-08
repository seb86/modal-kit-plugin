<?php
/**
 * Runs when Modal Kit is deleted. Data is only removed when "Delete all
 * modals and settings when the plugin is deleted" is on (Settings → Tools),
 * so deactivating or reinstalling never loses work. On a network, each site
 * decides for itself.
 *
 * @package ModalKit
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Whether a plugin that requires this one is still installed. It reads the same
 * switch when it is deleted, which may be after this plugin (the Plugins screen
 * deletes in list order).
 *
 * @return bool
 */
function modal_kit_uninstall_has_add_on() {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	foreach ( get_plugins() as $file => $data ) {
		$requires = array_map( 'trim', explode( ',', (string) ( $data['RequiresPlugins'] ?? '' ) ) );

		// In a bulk delete the list is cached, so check the plugin is still there.
		if ( in_array( 'modal-kit', $requires, true ) && file_exists( trailingslashit( WP_PLUGIN_DIR ) . $file ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Removes the current site's data, if the site asked for that.
 *
 * @return void
 */
function modal_kit_uninstall_site() {
	$tools = get_option( 'modal_kit_tools', array() );

	if ( empty( $tools['deleteOnUninstall'] ) ) {
		return;
	}

	$ids = get_posts(
		array(
			'post_type'      => 'mk_modal',
			'post_status'    => array_keys( get_post_stati() ),
			'posts_per_page' => -1,
			'fields'         => 'ids',
		)
	);

	foreach ( $ids as $id ) {
		wp_delete_post( $id, true );
	}

	foreach ( array( 'general', 'display', 'accessibility', 'pro', 'wizard_done', 'milestone_dismissed', 'user_styles' ) as $option ) {
		delete_option( 'modal_kit_' . $option );
	}

	// An add-on still to be deleted needs this, and removes it when it is.
	if ( ! modal_kit_uninstall_has_add_on() ) {
		delete_option( 'modal_kit_tools' );
	}
}

if ( is_multisite() ) {
	foreach ( get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	) as $modal_kit_site ) {
		switch_to_blog( $modal_kit_site );
		modal_kit_uninstall_site();
		restore_current_blog();
	}
} else {
	modal_kit_uninstall_site();
}

// Dismissed prompts are only a preference, and users are shared across a network.
delete_metadata( 'user', 0, 'modal_kit_dismissed', '', true );

<?php
/**
 * Plugin Name:       Modal Kit
 * Plugin URI:        https://github.com/seb86/modal-kit-plugin
 * Description:       Modals made of blocks: popups, slide-ins, bars, drawers, full-screen takeovers, bottom sheets and inline panels, built with core blocks.
 * Version:           0.1.0
 * Requires at least: 6.8
 * Requires PHP:      7.4
 * Author:            Sébastien Dumont
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       modal-kit
 *
 * @package ModalKit
 */

defined( 'ABSPATH' ) || exit;

define( 'MODAL_KIT_VERSION', '0.1.0' );
define( 'MODAL_KIT_FILE', __FILE__ );
define( 'MODAL_KIT_PATH', plugin_dir_path( __FILE__ ) );
define( 'MODAL_KIT_URL', plugin_dir_url( __FILE__ ) );

require_once MODAL_KIT_PATH . 'includes/autoload.php';

register_activation_hook( __FILE__, array( 'ModalKit\Wizard', 'activate' ) );

ModalKit\Plugin::instance()->boot();

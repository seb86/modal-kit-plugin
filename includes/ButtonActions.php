<?php
/**
 * Button actions: Open link, Close modal, Copy text.
 *
 * @package ModalKit
 */

namespace ModalKit;

use WP_HTML_Tag_Processor;

defined( 'ABSPATH' ) || exit;

/**
 * Adds runtime directives to core/button blocks that have a Modal Kit action.
 * The action lives in block attributes only; the saved markup is untouched.
 */
final class ButtonActions {

	/**
	 * Free actions. "link" is the default (the button's own link).
	 */
	const ACTIONS = array( 'link', 'close', 'copy' );

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_filter( 'render_block_core/button', array( $this, 'render' ), 10, 2 );
	}

	/**
	 * Adds the action's directives to the rendered button.
	 *
	 * @param string               $content Rendered button.
	 * @param array<string, mixed> $block   Parsed block.
	 * @return string
	 */
	public function render( $content, $block ) {
		$action = isset( $block['attrs']['modalKitAction'] ) ? (string) $block['attrs']['modalKitAction'] : '';

		/**
		 * Filters the button actions the runtime understands. Modal Kit Pro
		 * adds its own (next, previous, go to step, submit).
		 *
		 * @param string[] $actions Action names.
		 */
		$known = (array) apply_filters( 'modal_kit_button_actions', self::ACTIONS );

		if ( '' === $action || 'link' === $action || ! in_array( $action, $known, true ) ) {
			return $content;
		}

		$processor = new WP_HTML_Tag_Processor( $content );

		if ( ! $processor->next_tag( array( 'class_name' => 'wp-block-button__link' ) ) ) {
			return $content;
		}

		$processor->set_attribute( 'data-modal-kit-action', $action );
		$processor->set_attribute( 'data-wp-on--click', 'modal-kit::actions.buttonAction' );

		if ( 'copy' === $action ) {
			$text = isset( $block['attrs']['modalKitCopyText'] ) ? (string) $block['attrs']['modalKitCopyText'] : '';
			$processor->set_attribute( 'data-modal-kit-copy', $text );
		}

		// A link without an address isn't focusable: make it act as a button.
		if ( 'A' === $processor->get_tag() && null === $processor->get_attribute( 'href' ) ) {
			$processor->set_attribute( 'role', 'button' );
			$processor->set_attribute( 'tabindex', '0' );
			$processor->set_attribute( 'data-wp-on--keydown', 'modal-kit::actions.buttonKey' );
		}

		/**
		 * Filters the attributes added to an action button, for actions
		 * registered by add-ons.
		 *
		 * @param WP_HTML_Tag_Processor $processor Positioned on the button.
		 * @param string                $action    Action name.
		 * @param array<string, mixed>  $block     Parsed block.
		 */
		do_action( 'modal_kit_render_button_action', $processor, $action, $block );

		return $processor->get_updated_html();
	}
}

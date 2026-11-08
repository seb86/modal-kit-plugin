<?php
/**
 * Renders the Modal block's panel. The surrounding <dialog> is added by
 * ModalKit\Render, which prints modals once in the footer.
 *
 * @package ModalKit
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner blocks markup.
 * @var WP_Block $block      Block instance.
 */

defined( 'ABSPATH' ) || exit;

$modal_kit_resolved = ModalKit\Layouts::resolve( $attributes );
$modal_kit_close    = $modal_kit_resolved['closeOptions'];
$modal_kit_post_id  = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : 0;
$modal_kit_label    = ModalKit\Render::close_label( $modal_kit_post_id );
$modal_kit_auto     = ModalKit\Accessibility::for_modal( $modal_kit_post_id )['autoClose'];
?>
<div <?php echo get_block_wrapper_attributes( array( 'class' => 'modal-kit__panel' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped by core. ?>>
	<?php echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Rendered inner blocks. ?>
	<?php if ( $modal_kit_close['button'] ) : ?>
		<button type="button" class="modal-kit__close<?php echo $modal_kit_close['visibleLabel'] ? ' has-label' : ''; ?>" data-wp-on--click="actions.close"<?php echo $modal_kit_close['visibleLabel'] ? '' : ' aria-label="' . esc_attr( $modal_kit_label ) . '"'; ?>>
			<?php if ( $modal_kit_close['visibleLabel'] ) : ?>
				<span class="modal-kit__close-label"><?php echo esc_html( $modal_kit_label ); ?></span>
			<?php endif; ?>
			<svg class="modal-kit__close-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
		</button>
	<?php endif; ?>
	<?php if ( $modal_kit_auto ) : ?>
		<?php // Auto-close needs a way to stop it (WCAG 2.2.1). ?>
		<button type="button" class="modal-kit__pause" aria-pressed="false" data-wp-on--click="actions.toggleAutoClose"><?php esc_html_e( 'Pause', 'modal-kit' ); ?></button>
	<?php endif; ?>
</div>

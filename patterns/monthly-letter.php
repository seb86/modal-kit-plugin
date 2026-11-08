<?php
/**
 * Starter pattern: Monthly letter (centered newsletter invite).
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

defined( 'ABSPATH' ) || exit;

return array(
	'slug'        => 'modal-kit/monthly-letter',
	'title'       => _x( 'Monthly letter', 'Pattern title', 'modal-kit' ),
	'description' => __( 'A centered invite to join a newsletter.', 'modal-kit' ),
	'categories'  => array( 'modal-kit-newsletter' ),
	'keywords'    => array( __( 'newsletter', 'modal-kit' ), __( 'signup', 'modal-kit' ), __( 'email', 'modal-kit' ) ),
	'content'     => Patterns::modal(
		array(
			'modalLayout' => 'centered',
			'size'        => 's',
		),
		array(
			Patterns::paragraph(
				__( 'Newsletter', 'modal-kit' ),
				array(
					'eyebrow'  => true,
					'fontSize' => Patterns::font_size( 'small' ),
				)
			),
			Patterns::heading( __( 'One good idea, once a month.', 'modal-kit' ) ),
			Patterns::paragraph( __( 'Essays on craft and the tools we make, sent the first Sunday of every month. No noise, unsubscribe anytime.', 'modal-kit' ) ),
			Patterns::buttons(
				array(
					array(
						'text' => __( 'Join the list', 'modal-kit' ),
						'url'  => '#',
					),
				)
			),
		)
	),
);

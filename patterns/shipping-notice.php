<?php
/**
 * Starter pattern: Shipping notice (top bar).
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

defined( 'ABSPATH' ) || exit;

return array(
	'slug'        => 'modal-kit/shipping-notice',
	'title'       => _x( 'Shipping notice', 'Pattern title', 'modal-kit' ),
	'description' => __( 'A slim bar across the top of the page with one link.', 'modal-kit' ),
	'categories'  => array( 'modal-kit-promo' ),
	'keywords'    => array( __( 'bar', 'modal-kit' ), __( 'shipping', 'modal-kit' ), __( 'notice', 'modal-kit' ) ),
	'content'     => Patterns::modal(
		array(
			'modalLayout'     => 'bar',
			'position'        => 'top',
			'backgroundColor' => Patterns::color( 'accent' ),
			'textColor'       => Patterns::color( 'on-accent' ),
		),
		array(
			Patterns::group(
				array(
					Patterns::paragraph( __( 'Free shipping on orders over $40 this week', 'modal-kit' ) ),
					Patterns::buttons(
						array(
							array(
								'text'    => __( 'Shop', 'modal-kit' ),
								'url'     => '#',
								'outline' => true,
							),
						)
					),
				),
				array(
					'layout' => array(
						'type'           => 'flex',
						'justifyContent' => 'center',
					),
				)
			),
		)
	),
);

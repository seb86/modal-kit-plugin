<?php
/**
 * Starter pattern: Discount code (split promo).
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

defined( 'ABSPATH' ) || exit;

return array(
	'slug'        => 'modal-kit/discount-code',
	'title'       => _x( 'Discount code', 'Pattern title', 'modal-kit' ),
	'description' => __( 'A split promo with a highlighted offer and a code to copy.', 'modal-kit' ),
	'categories'  => array( 'modal-kit-promo' ),
	'keywords'    => array( __( 'sale', 'modal-kit' ), __( 'coupon', 'modal-kit' ), __( 'discount', 'modal-kit' ) ),
	'content'     => Patterns::modal(
		array(
			'modalLayout' => 'split',
			'position'    => 'media-left',
		),
		array(
			// The first block is the media half. Swap it for an Image or Cover.
			Patterns::group(
				array(
					Patterns::heading(
						__( '20%', 'modal-kit' ),
						array(
							'level'     => 3,
							'textAlign' => 'center',
							'fontSize'  => Patterns::font_size( 'x-large' ),
						)
					),
				),
				array(
					'backgroundColor' => Patterns::color( 'accent' ),
					'textColor'       => Patterns::color( 'on-accent' ),
					'layout'          => array(
						'type'              => 'flex',
						'orientation'       => 'vertical',
						'justifyContent'    => 'center',
						'verticalAlignment' => 'center',
					),
				)
			),
			Patterns::group(
				array(
					Patterns::paragraph(
						__( 'Autumn sale · ends Sunday', 'modal-kit' ),
						array(
							'eyebrow'  => true,
							'fontSize' => Patterns::font_size( 'small' ),
						)
					),
					Patterns::heading( __( '20% off every notebook and pen.', 'modal-kit' ) ),
					Patterns::paragraph( __( 'Use the code at checkout. Free shipping over $40.', 'modal-kit' ) ),
					Patterns::group(
						array(
							Patterns::paragraph( __( 'AUTUMN20', 'modal-kit' ), array( 'fontSize' => Patterns::font_size( 'large' ) ) ),
							Patterns::buttons(
								array(
									array(
										'text'    => __( 'Copy', 'modal-kit' ),
										'outline' => true,
										'action'  => 'copy',
										'copy'    => __( 'AUTUMN20', 'modal-kit' ),
									),
								)
							),
						),
						array(
							// The code on its own line, Copy underneath: it never
							// squeezes in a narrow column.
							'layout' => array(
								'type'        => 'flex',
								'orientation' => 'vertical',
							),
						)
					),
					Patterns::buttons(
						array(
							array(
								'text' => __( 'Shop the sale', 'modal-kit' ),
								'url'  => '#',
							),
						)
					),
				)
			),
		)
	),
);

<?php
/**
 * Starter pattern: Product drop (slide-in corner).
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

defined( 'ABSPATH' ) || exit;

return array(
	'slug'        => 'modal-kit/product-drop',
	'title'       => _x( 'Product drop', 'Pattern title', 'modal-kit' ),
	'description' => __( 'A small corner slide-in announcing something new.', 'modal-kit' ),
	'categories'  => array( 'modal-kit-announcement' ),
	'keywords'    => array( __( 'new', 'modal-kit' ), __( 'launch', 'modal-kit' ), __( 'slide-in', 'modal-kit' ) ),
	'content'     => Patterns::modal(
		array(
			'modalLayout' => 'corner',
			'position'    => 'bottom-right',
			'size'        => 's',
		),
		array(
			Patterns::paragraph(
				__( 'New', 'modal-kit' ),
				array(
					'eyebrow'  => true,
					'fontSize' => Patterns::font_size( 'small' ),
				)
			),
			Patterns::heading( __( 'The pocket ledger is back.', 'modal-kit' ), array( 'level' => 3 ) ),
			Patterns::buttons(
				array(
					array(
						'text' => __( 'See it →', 'modal-kit' ),
						'url'  => '#',
					),
				)
			),
		)
	),
);

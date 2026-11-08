<?php
/**
 * Starter pattern: Parting gift (full-screen exit offer).
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

defined( 'ABSPATH' ) || exit;

return array(
	'slug'        => 'modal-kit/parting-gift',
	'title'       => _x( 'Parting gift', 'Pattern title', 'modal-kit' ),
	'description' => __( 'A full-screen, high-contrast offer for visitors about to leave.', 'modal-kit' ),
	'categories'  => array( 'modal-kit-exit' ),
	'keywords'    => array( __( 'leaving the page', 'modal-kit' ), __( 'download', 'modal-kit' ), __( 'guide', 'modal-kit' ) ),
	'content'     => Patterns::modal(
		array(
			'modalLayout' => 'full',
			'className'   => 'is-style-editorial',
		),
		array(
			Patterns::paragraph(
				__( 'Before you go', 'modal-kit' ),
				array(
					'eyebrow'  => true,
					'fontSize' => Patterns::font_size( 'small' ),
				)
			),
			Patterns::heading( __( 'Take the field guide with you.', 'modal-kit' ) ),
			Patterns::paragraph( __( 'Forty pages on choosing paper, breaking in a pen and keeping a notebook you’ll actually reread. Free, no account.', 'modal-kit' ) ),
			Patterns::buttons(
				array(
					array(
						'text' => __( 'Download the guide (PDF)', 'modal-kit' ),
						'url'  => '#',
					),
				)
			),
		)
	),
);

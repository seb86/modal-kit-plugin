<?php
/**
 * Starter pattern: Event announcement (side drawer).
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

defined( 'ABSPATH' ) || exit;

return array(
	'slug'        => 'modal-kit/event-announcement',
	'title'       => _x( 'Event announcement', 'Pattern title', 'modal-kit' ),
	'description' => __( 'A side drawer with the details of an upcoming event.', 'modal-kit' ),
	'categories'  => array( 'modal-kit-announcement' ),
	'keywords'    => array( __( 'event', 'modal-kit' ), __( 'workshop', 'modal-kit' ), __( 'drawer', 'modal-kit' ) ),
	'content'     => Patterns::modal(
		array(
			'modalLayout' => 'drawer',
			'position'    => 'right',
		),
		array(
			Patterns::paragraph(
				__( 'Workshops', 'modal-kit' ),
				array(
					'eyebrow'  => true,
					'fontSize' => Patterns::font_size( 'small' ),
				)
			),
			Patterns::heading( __( 'Bookbinding, Nov 8', 'modal-kit' ) ),
			Patterns::paragraph( __( 'A half-day class in the studio. Twelve seats, materials included.', 'modal-kit' ) ),
			Patterns::buttons(
				array(
					array(
						'text' => __( 'Reserve a seat', 'modal-kit' ),
						'url'  => '#',
					),
				)
			),
		)
	),
);

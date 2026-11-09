<?php
/**
 * Starter pattern: Video tour (video lightbox).
 *
 * @package ModalKit
 */

use ModalKit\Patterns;

defined( 'ABSPATH' ) || exit;

return array(
	'slug'        => 'modal-kit/video-tour',
	'title'       => _x( 'Video tour', 'Pattern title', 'modal-kit' ),
	'description' => __( 'A video lightbox with a caption and a button under the player.', 'modal-kit' ),
	'categories'  => array( 'modal-kit-video' ),
	'keywords'    => array( __( 'video', 'modal-kit' ), __( 'tour', 'modal-kit' ), __( 'lightbox', 'modal-kit' ) ),
	'content'     => Patterns::modal(
		array(
			'modalLayout'  => 'video',
			'overlay'      => array(
				'show'    => true,
				'color'   => Patterns::color( 'contrast' ),
				'opacity' => 92,
				'blur'    => false,
			),
			'closeOptions' => array(
				'button'       => true,
				'esc'          => true,
				'outside'      => true,
				'visibleLabel' => true,
			),
		),
		array(
			// An empty Video block: choose a file, or swap it for an Embed.
			"<!-- wp:video -->\n<figure class=\"wp-block-video\"></figure>\n<!-- /wp:video -->",
			Patterns::heading( __( 'The three-minute tour', 'modal-kit' ), array( 'level' => 3 ) ),
			Patterns::paragraph( __( 'How we make a Field Notebook, start to finish.', 'modal-kit' ) ),
			Patterns::buttons(
				array(
					array(
						'text' => __( 'Shop the notebooks', 'modal-kit' ),
						'url'  => '#',
					),
				)
			),
		)
	),
);

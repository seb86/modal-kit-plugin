<?php
/**
 * Tests for button actions and modal link search.
 *
 * @package ModalKit
 */

use ModalKit\PostType;

/**
 * @covers \ModalKit\ButtonActions
 * @covers \ModalKit\Rest\Search
 */
class ButtonActionsTest extends WP_UnitTestCase {

	/**
	 * Renders a core/button with attributes.
	 *
	 * @param array<string, mixed> $attrs Attributes.
	 * @param string               $href  Link address.
	 * @return string
	 */
	private function button( $attrs, $href = '' ) {
		$link = '<a class="wp-block-button__link wp-element-button"' . ( $href ? ' href="' . $href . '"' : '' ) . '>Go</a>';

		return do_blocks( '<!-- wp:button ' . wp_json_encode( (object) $attrs ) . ' --><div class="wp-block-button">' . $link . '</div><!-- /wp:button -->' );
	}

	public function test_link_buttons_are_left_alone() {
		$this->assertStringNotContainsString( 'data-modal-kit-action', $this->button( array(), '/shop/' ) );
		$this->assertStringNotContainsString( 'data-modal-kit-action', $this->button( array( 'modalKitAction' => 'link' ), '/shop/' ) );
	}

	public function test_close_and_copy_add_directives() {
		$close = new WP_HTML_Tag_Processor( $this->button( array( 'modalKitAction' => 'close' ) ) );
		$close->next_tag( array( 'class_name' => 'wp-block-button__link' ) );

		$this->assertSame( 'close', $close->get_attribute( 'data-modal-kit-action' ) );
		$this->assertSame( 'modal-kit::actions.buttonAction', $close->get_attribute( 'data-wp-on--click' ) );
		$this->assertSame( 'button', $close->get_attribute( 'role' ) );
		$this->assertSame( '0', $close->get_attribute( 'tabindex' ) );

		$copy = new WP_HTML_Tag_Processor(
			$this->button(
				array(
					'modalKitAction'   => 'copy',
					'modalKitCopyText' => 'AUTUMN20',
				),
				'#'
			)
		);
		$copy->next_tag( array( 'class_name' => 'wp-block-button__link' ) );

		$this->assertSame( 'AUTUMN20', $copy->get_attribute( 'data-modal-kit-copy' ) );
		$this->assertNull( $copy->get_attribute( 'role' ) );
	}

	public function test_unknown_actions_are_ignored() {
		$this->assertStringNotContainsString( 'data-modal-kit-action', $this->button( array( 'modalKitAction' => 'next-step' ) ) );
	}

	public function test_modals_appear_in_link_search_for_editors_only() {
		self::factory()->post->create(
			array(
				'post_type'   => PostType::NAME,
				'post_status' => 'publish',
				'post_title'  => 'Field guide offer',
				'post_name'   => 'field-guide',
			)
		);

		$search = static function () {
			$request = new WP_REST_Request( 'GET', '/wp/v2/search' );
			$request->set_query_params(
				array(
					'search'  => 'Field guide',
					'type'    => 'post',
					'subtype' => 'any',
				)
			);

			return rest_get_server()->dispatch( $request )->get_data();
		};

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$results = $search();
		$modal   = wp_list_filter( $results, array( 'subtype' => 'modal' ) );

		$this->assertCount( 1, $modal );
		$this->assertSame( '#modal-field-guide', reset( $modal )['url'] );

		wp_set_current_user( 0 );
		$this->assertCount( 0, wp_list_filter( $search(), array( 'subtype' => 'modal' ) ) );

		$explicit = new WP_REST_Request( 'GET', '/wp/v2/search' );
		$explicit->set_query_params(
			array(
				'search'  => 'Field guide',
				'type'    => 'post',
				'subtype' => PostType::NAME,
			)
		);
		$this->assertSame( array(), rest_get_server()->dispatch( $explicit )->get_data() );
	}
}

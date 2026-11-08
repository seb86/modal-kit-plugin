<?php
/**
 * Tests for video preparation and video lightbox links.
 *
 * @package ModalKit
 */

use ModalKit\Video;
use ModalKit\VideoLinks;

/**
 * @covers \ModalKit\Video
 * @covers \ModalKit\VideoLinks
 */
class VideoTest extends WP_UnitTestCase {

	const IFRAME = '<figure class="wp-block-embed"><div class="wp-block-embed__wrapper"><iframe title="Tour" src="https://www.youtube.com/embed/abc123?feature=oembed"></iframe></div></figure>';

	public function test_providers() {
		$this->assertSame( 'youtube', Video::provider( 'https://www.youtube.com/embed/x' ) );
		$this->assertSame( 'youtube', Video::provider( 'https://youtu.be/x' ) );
		$this->assertSame( 'vimeo', Video::provider( 'https://player.vimeo.com/video/1' ) );
		$this->assertSame( '', Video::provider( 'https://example.org/video.mp4' ) );
		$this->assertSame( '', Video::provider( 'https://youtube.com.evil.test/embed/x' ) );
	}

	public function test_youtube_uses_nocookie_and_the_player_api() {
		$url = Video::player_url( 'https://www.youtube.com/embed/abc123?feature=oembed' );

		$this->assertStringStartsWith( 'https://www.youtube-nocookie.com/embed/abc123', $url );
		$this->assertStringContainsString( 'enablejsapi=1', $url );
		$this->assertStringStartsWith( 'https://www.youtube.com/', Video::player_url( 'https://www.youtube.com/embed/abc123', false ) );
	}

	public function test_embeds_load_on_open_behind_a_click_to_load_screen() {
		$html = Video::prepare( self::IFRAME, Video::defaults() );

		$processor = new WP_HTML_Tag_Processor( $html );
		$processor->next_tag( 'iframe' );

		$this->assertNull( $processor->get_attribute( 'src' ) );
		$this->assertStringContainsString( 'youtube-nocookie.com', $processor->get_attribute( 'data-modal-kit-src' ) );
		$this->assertSame( 'youtube', $processor->get_attribute( 'data-modal-kit-provider' ) );
		$this->assertStringContainsString( 'Loads from YouTube, which may set cookies.', $html );
	}

	public function test_loading_with_the_page_keeps_the_source() {
		$settings = array_merge(
			Video::defaults(),
			array(
				'load'        => 'page',
				'clickToLoad' => false,
			)
		);

		$html = Video::prepare( self::IFRAME, $settings );

		$this->assertStringContainsString( 'src="https://www.youtube-nocookie.com/embed/abc123', $html );
		$this->assertStringNotContainsString( 'modal-kit-consent', $html );
	}

	public function test_self_hosted_video_loads_on_open() {
		$html = Video::prepare( '<figure class="wp-block-video"><video controls src="/v.mp4"></video></figure>', Video::defaults() );

		$this->assertStringContainsString( 'preload="none"', $html );
		$this->assertStringContainsString( 'playsinline', $html );
	}

	public function test_video_links_need_the_toggle_and_a_playable_url() {
		$button = static function ( $attrs, $href ) {
			return do_blocks( '<!-- wp:button ' . wp_json_encode( (object) $attrs ) . ' --><div class="wp-block-button"><a class="wp-block-button__link" href="' . $href . '">Watch</a></div><!-- /wp:button -->' );
		};

		$this->assertStringNotContainsString( 'data-modal-kit-video', $button( array(), 'https://youtu.be/abc' ) );
		$this->assertStringNotContainsString( 'data-modal-kit-video', $button( array( 'modalKitVideoLightbox' => true ), 'https://example.org/page' ) );

		$html = $button( array( 'modalKitVideoLightbox' => true ), 'https://youtu.be/abc' );
		$this->assertStringContainsString( 'data-modal-kit-video="https://youtu.be/abc"', $html );
		$this->assertStringContainsString( 'href="https://youtu.be/abc"', $html );
		$this->assertTrue( VideoLinks::needed() );
	}
}

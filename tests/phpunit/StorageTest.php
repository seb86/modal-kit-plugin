<?php
/**
 * What the browser remembers stays separate for sites in subfolders.
 *
 * @package ModalKit
 */

use ModalKit\Storage;

/**
 * Storage scope.
 */
class StorageTest extends WP_UnitTestCase {

	/**
	 * The meta tag a page prints.
	 *
	 * @return string
	 */
	private function printed() {
		ob_start();
		Storage::print_scope();

		return (string) ob_get_clean();
	}

	/**
	 * A site at the domain's root keeps plain keys and prints nothing.
	 *
	 * @return void
	 */
	public function test_a_site_at_the_root_is_unchanged() {
		foreach ( array( 'https://example.com', 'https://example.com/' ) as $home ) {
			update_option( 'home', $home );

			$this->assertSame( '', Storage::scope() );
			$this->assertSame( 'modal-kit:', Storage::prefix() );
			$this->assertSame( '', $this->printed() );
		}
	}

	/**
	 * A site in a subfolder gets its path, however it's written.
	 *
	 * @return void
	 */
	public function test_a_site_in_a_subfolder_gets_its_path() {
		$homes = array(
			'https://example.com/site2'  => '/site2/',
			'https://example.com/site2/' => '/site2/',
			'https://example.com/a/b'    => '/a/b/',
		);

		foreach ( $homes as $home => $scope ) {
			update_option( 'home', $home );

			$this->assertSame( $scope, Storage::scope() );
			$this->assertSame( 'modal-kit:' . $scope, Storage::prefix() );
			$this->assertStringContainsString( 'name="modal-kit-scope" content="' . $scope . '"', $this->printed() );
		}
	}

	/**
	 * A language folder from a translation plugin isn't another site.
	 *
	 * @return void
	 */
	public function test_a_filtered_home_url_is_ignored() {
		update_option( 'home', 'https://example.com' );

		$language = static function ( $url ) {
			return trailingslashit( $url ) . 'fr/';
		};

		add_filter( 'home_url', $language );
		$scope = Storage::scope();
		remove_filter( 'home_url', $language );

		$this->assertSame( '', $scope );
	}

	/**
	 * The path is escaped.
	 *
	 * @return void
	 */
	public function test_the_path_is_escaped() {
		$home = static function () {
			return 'https://example.com/a"b';
		};

		add_filter( 'pre_option_home', $home );
		$printed = $this->printed();
		remove_filter( 'pre_option_home', $home );

		$this->assertStringContainsString( 'content="/a&quot;b/"', $printed );
	}

	/**
	 * The front end and the admin both print it, early.
	 *
	 * @return void
	 */
	public function test_it_prints_in_both_heads() {
		$this->assertSame( 1, has_action( 'wp_head', array( Storage::class, 'print_scope' ) ) );
		$this->assertSame( 1, has_action( 'admin_head', array( Storage::class, 'print_scope' ) ) );
	}

	/**
	 * On a network, each site in a subfolder has its own scope.
	 *
	 * @return void
	 */
	public function test_each_site_on_a_network_has_its_own_scope() {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Needs a network: npm run test:multisite.' );
		}

		$two   = self::factory()->blog->create( array( 'path' => '/two/' ) );
		$three = self::factory()->blog->create( array( 'path' => '/three/' ) );

		switch_to_blog( $two );
		$scope_two = Storage::scope();
		restore_current_blog();

		switch_to_blog( $three );
		$scope_three = Storage::scope();
		restore_current_blog();

		$this->assertSame( '/two/', $scope_two );
		$this->assertSame( '/three/', $scope_three );
	}
}

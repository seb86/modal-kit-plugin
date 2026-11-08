<?php
/**
 * Demo content for the local dev site: every starter (free and Pro) and the
 * Pro 1.3 features as a published modal with real conditions, each on a page
 * of its own that explains it, under "Modal Kit demos".
 *
 * Run with `npm run demos` (WP-CLI `eval-file` on the dev site). Running it
 * again updates the demos in place (same IDs), keeps any demo modal edited by
 * hand since the last run, and removes demos no longer in the list. It
 * refuses to run anywhere but a local site.
 *
 * @package ModalKit
 */

// phpcs:disable WordPress.WP.GlobalVariablesOverride.Prohibited, WordPress.NamingConventions.PrefixAllGlobals -- A WP-CLI script, not plugin code.

use ModalKit\Admin\ModalList;
use ModalKit\Meta;
use ModalKit\Patterns;
use ModalKit\PostType;

defined( 'ABSPATH' ) || exit;

if ( ! in_array( wp_parse_url( home_url(), PHP_URL_HOST ), array( 'localhost', '127.0.0.1' ), true ) ) {
	WP_CLI::error( 'Demos are for the local dev site only.' );
}

if ( ! class_exists( Patterns::class ) ) {
	WP_CLI::error( 'Modal Kit must be active.' );
}

$pro = class_exists( '\ModalKit\Pro\Plugin' );
$woo = class_exists( 'WooCommerce' );

// Admins may post the demo's small reset script (unfiltered_html).
$admin = get_user_by( 'login', 'admin' );
wp_set_current_user( $admin ? $admin->ID : 1 );

/* Existing demos ---------------------------------------------------------- */

// Demos are updated in place (same IDs, so an open editor keeps working),
// and a demo modal edited since it was seeded is left as it is. Demos that
// are no longer in the list are deleted at the end.
$existing = array();

foreach ( get_posts(
	array(
		'post_type'      => array( 'page', PostType::NAME, 'product', 'shop_coupon' ),
		'post_status'    => 'any',
		'posts_per_page' => -1,
		'meta_key'       => '_modal_kit_demo',
	)
) as $existing_post ) {
	$existing[ $existing_post->post_type . ':' . $existing_post->post_name ] = $existing_post;
}

$kept   = array();
$seeded = time();

/**
 * Creates or updates a demo post by type and slug.
 *
 * @return array{0: int, 1: bool} ID, and whether the owner edited it since it was seeded.
 */
$upsert = static function ( $args ) use ( &$existing, &$kept, $seeded ) {
	$key  = $args['post_type'] . ':' . $args['post_name'];
	$post = isset( $existing[ $key ] ) ? $existing[ $key ] : null;

	if ( $post ) {
		$kept[ $post->ID ] = true;
		$was_seeded        = (int) get_post_meta( $post->ID, '_modal_kit_demo', true );

		// Edited by hand since the last run (a minute's grace for the run itself).
		if ( PostType::NAME === $post->post_type && $was_seeded > 1 && strtotime( $post->post_modified_gmt . ' UTC' ) > $was_seeded + 60 ) {
			return array( $post->ID, true );
		}

		$args['ID'] = $post->ID;
		wp_update_post( $args );
		update_post_meta( $post->ID, '_modal_kit_demo', $seeded );

		return array( $post->ID, false );
	}

	$id = wp_insert_post( $args );
	update_post_meta( $id, '_modal_kit_demo', $seeded );
	$kept[ $id ] = true;

	return array( $id, false );
};

/* Block markup helpers ----------------------------------------------------- */

$h = static function ( $text, $level = 2 ) {
	$attrs = 2 === $level ? '' : ' {"level":' . $level . '}';

	return '<!-- wp:heading' . $attrs . ' --><h' . $level . ' class="wp-block-heading">' . esc_html( $text ) . '</h' . $level . '><!-- /wp:heading -->';
};

$p = static function ( $html ) {
	return '<!-- wp:paragraph --><p>' . $html . '</p><!-- /wp:paragraph -->';
};

$items = static function ( $lines ) {
	$out = '<!-- wp:list --><ul class="wp-block-list">';

	foreach ( $lines as $line ) {
		$out .= '<!-- wp:list-item --><li>' . $line . '</li><!-- /wp:list-item -->';
	}

	return $out . '</ul><!-- /wp:list -->';
};

$spacer = static function ( $height ) {
	return '<!-- wp:spacer {"height":"' . $height . 'px"} --><div style="height:' . $height . 'px" aria-hidden="true" class="wp-block-spacer"></div><!-- /wp:spacer -->';
};

// Clears what this browser remembers about modals, then loads the page again.
$actions = static function ( $dom_id ) {
	$reset = "try{Object.keys(localStorage).filter(function(k){return k.indexOf('modal-kit:')===0}).forEach(function(k){localStorage.removeItem(k)})}catch(e){}location.reload()";
	$html  = '<div class="wp-block-buttons is-layout-flex" style="display:flex;flex-wrap:wrap;gap:12px">'
		. '<div class="wp-block-button"><button type="button" class="wp-block-button__link wp-element-button" onclick="' . esc_attr( $reset ) . '">Reload the demo</button></div>';

	if ( $dom_id ) {
		// Outline styles load only with a core Button block on the page, so
		// this one carries its own: the text colour, on no background.
		$html .= '<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" style="background:transparent;color:inherit;border:2px solid currentColor" href="#' . esc_attr( $dom_id ) . '">Open it now</a></div>';
	}

	return '<!-- wp:html -->' . $html . '</div><!-- /wp:html -->';
};

$products_block = '<!-- wp:woocommerce/product-collection {"queryId":7,"query":{"perPage":3,"pages":0,"offset":0,"postType":"product","order":"asc","orderBy":"title","search":"","exclude":[],"inherit":false,"taxQuery":{},"isProductCollectionBlock":true,"woocommerceOnSale":false,"woocommerceStockStatus":["instock","outofstock","onbackorder"],"woocommerceAttributes":[],"woocommerceHandPickedProducts":[]},"tagName":"div","displayLayout":{"type":"flex","columns":3}} --><div class="wp-block-woocommerce-product-collection"><!-- wp:woocommerce/product-template --><!-- wp:post-title {"level":3,"isLink":true,"__woocommerceNamespace":"woocommerce/product-collection/product-title"} /--><!-- wp:woocommerce/product-price {"isDescendentOfQueryLoop":true} /--><!-- wp:woocommerce/product-button {"isDescendentOfQueryLoop":true} /--><!-- /wp:woocommerce/product-template --></div><!-- /wp:woocommerce/product-collection -->';

/* WooCommerce: demo products, sample reviews, coupons ---------------------- */

$product_ids = array();

if ( $woo ) {
	$new_products = false;

	foreach ( array(
		array( 'Autumn journal', '24', 'Lay-flat binding, 120gsm paper.' ),
		array( 'Copper pen clip', '9', 'Fits any notebook cover.' ),
		array( 'Linen sketchbook', '18', 'Heavy paper for ink and wash.' ),
	) as $item ) {
		$key = 'product:' . sanitize_title( $item[0] );

		if ( isset( $existing[ $key ] ) ) {
			$product_ids[]                 = $existing[ $key ]->ID;
			$kept[ $existing[ $key ]->ID ] = true;
			continue;
		}

		$new_products = true;
		$product      = new WC_Product_Simple();
		$product->set_name( $item[0] );
		$product->set_regular_price( $item[1] );
		$product->set_short_description( $item[2] );
		$product->set_status( 'publish' );
		$id = $product->save();
		update_post_meta( $id, '_modal_kit_demo', $seeded );
		$kept[ $id ]   = true;
		$product_ids[] = $id;
	}

	// Sample reviews, labelled as samples, for the reviews demos (once).
	foreach ( ! $new_products ? array() : array(
		array( 0, 'Sample reviewer', 5, 'Sample review for the demo: the paper takes fountain pen ink with no bleed.' ),
		array( 0, 'Demo customer', 4, 'Sample review for the demo: lies flat, arrived quickly.' ),
		array( 2, 'Test buyer', 2, 'Sample review for the demo: lovely paper, but the cover scuffs.' ),
	) as $review ) {
		$comment = wp_insert_comment(
			array(
				'comment_post_ID'      => $product_ids[ $review[0] ],
				'comment_author'       => $review[1],
				'comment_author_email' => 'demo@example.com',
				'comment_content'      => $review[3],
				'comment_type'         => 'review',
				'comment_approved'     => 1,
			)
		);
		update_comment_meta( $comment, 'rating', $review[2] );
	}

	foreach ( array( 'WELCOME10', 'SHIPFREE', 'THANKYOU15', 'STAY10', 'TREAT15', 'FREESHIP', 'AUTUMN20' ) as $code ) {
		$coupon_id = wc_get_coupon_id_by_code( $code );

		if ( $coupon_id ) {
			$kept[ $coupon_id ] = true;
			continue;
		}

		$coupon = new WC_Coupon();
		$coupon->set_code( $code );
		$coupon->set_discount_type( 'percent' );
		$coupon->set_amount( (float) preg_replace( '/\D/', '', $code ) ? (float) preg_replace( '/\D/', '', $code ) : 0 );
		$coupon->set_free_shipping( false !== strpos( $code, 'SHIP' ) );
		$id = $coupon->save();
		update_post_meta( $id, '_modal_kit_demo', $seeded );
		$kept[ $id ] = true;
	}

	WP_CLI::log( 'WooCommerce: demo products, sample reviews and coupons ready.' );
}

/* Conditions for starters that don't bring their own ----------------------- */

$load   = static function ( $delay ) {
	return array(
		array(
			'type'  => 'load',
			'delay' => $delay,
		),
	);
};
$scroll = static function ( $percent ) {
	return array(
		array(
			'type'    => 'scroll',
			'percent' => $percent,
		),
	);
};
$time   = static function ( $seconds ) {
	return array(
		array(
			'type'  => 'time',
			'delay' => $seconds,
		),
	);
};
$leave  = array(
	array(
		'type'  => 'exit',
		'touch' => 'scroll-up',
	),
);

$conditions = array(
	'modal-kit/discount-code'           => array( 'triggers' => $load( 3 ) ),
	'modal-kit/event-announcement'      => array( 'triggers' => $scroll( 30 ) ),
	'modal-kit/monthly-letter'          => array( 'triggers' => $time( 15 ) ),
	'modal-kit/parting-gift'            => array( 'triggers' => $leave ),
	'modal-kit/product-drop'            => array( 'triggers' => $scroll( 50 ) ),
	'modal-kit/shipping-notice'         => array( 'triggers' => $load( 0 ) ),
	'modal-kit/video-tour'              => array( 'triggers' => array() ),
	'modal-kit-pro/cart-reminder'       => array(
		'triggers' => $time( 10 ),
		'rules'    => array( 'shop' => array( 'cart' => 'not-empty' ) ),
	),
	'modal-kit-pro/countdown-bar'       => array( 'triggers' => $load( 0 ) ),
	'modal-kit-pro/donation-appeal'     => array( 'triggers' => $leave ),
	'modal-kit-pro/event-rsvp'          => array( 'triggers' => $scroll( 40 ) ),
	'modal-kit-pro/feature-tour'        => array( 'triggers' => array() ),
	'modal-kit-pro/pick-a-gift'         => array( 'triggers' => $time( 8 ) ),
	'modal-kit-pro/scratch-to-reveal'   => array( 'triggers' => $scroll( 30 ) ),
	'modal-kit-pro/spin-to-win'         => array( 'triggers' => $load( 3 ) ),
	'modal-kit-pro/three-in-a-row'      => array( 'triggers' => $load( 5 ) ),
	'modal-kit-pro/holiday-hours'       => array( 'triggers' => $load( 0 ) ),
	'modal-kit-pro/lead-magnet'         => array( 'triggers' => $scroll( 50 ) ),
	'modal-kit-pro/order-feedback'      => array( 'triggers' => $load( 2 ) ),
	'modal-kit-pro/product-finder-quiz' => array( 'triggers' => $load( 5 ) ),
	'modal-kit-pro/trial-signup'        => array( 'triggers' => $time( 20 ) ),
	'modal-kit-pro/video-end-screen'    => array( 'triggers' => array() ),
	'modal-kit-pro/volunteer-signup'    => array( 'triggers' => $scroll( 50 ) ),
	'modal-kit-pro/webinar-countdown'   => array( 'triggers' => $load( 3 ) ),
	'modal-kit-pro/welcome-mat'         => array( 'triggers' => $load( 0 ) ),
	'modal-kit-pro/welcome-offer'       => array(
		'triggers' => $load( 3 ),
		'rules'    => array( 'audience' => array( 'visitors' => 'new' ) ),
	),
	'modal-kit-pro/added-to-cart'       => array(
		'triggers' => array(
			array(
				'type'          => 'woo-added',
				'replaceNotice' => true,
			),
		),
	),
	'modal-kit-pro/complete-the-set'    => array(
		'triggers' => array(
			array(
				'type'          => 'woo-added',
				'replaceNotice' => false,
			),
		),
	),
	'modal-kit-pro/bundle-and-save'     => array(
		'triggers' => array(
			array(
				'type'     => 'woo-in-cart',
				'products' => $product_ids ? array( $product_ids[0] ) : array(),
			),
		),
	),
	'modal-kit-pro/cart-exit-coupon'    => array(
		'triggers' => $leave,
		'rules'    => array( 'shop' => array( 'cart' => 'not-empty' ) ),
	),
	'modal-kit-pro/quick-view'          => array(
		'triggers' => array(
			array(
				'type'      => 'woo-quick-view',
				'label'     => 'Quick view',
				'placement' => 'always',
			),
		),
	),
);

$store_starters = array( 'cart-reminder', 'added-to-cart', 'complete-the-set', 'bundle-and-save', 'cart-exit-coupon', 'quick-view' );

/* Every starter ------------------------------------------------------------ */

$labels   = array_merge( Patterns::categories(), Patterns::collections() );
$settings = Patterns::starter_settings();
$demos    = array();

foreach ( WP_Block_Patterns_Registry::get_instance()->get_all_registered() as $pattern ) {
	if ( ! preg_match( '#^modal-kit(-pro)?/#', $pattern['name'] ) ) {
		continue;
	}

	$short = substr( $pattern['name'], strpos( $pattern['name'], '/' ) + 1 );

	if ( in_array( $short, $store_starters, true ) && ! $woo ) {
		continue;
	}

	$group = '';
	foreach ( (array) $pattern['categories'] as $category ) {
		if ( isset( $labels[ $category ] ) ) {
			$group = $labels[ $category ];
			// A Pro collection wins over a free category.
			if ( 0 === strpos( $category, 'modal-kit-pro-' ) ) {
				break;
			}
		}
	}

	$demos[] = array(
		'slug'        => $short,
		'title'       => $pattern['title'],
		'description' => isset( $pattern['description'] ) ? $pattern['description'] : '',
		'group'       => ( 0 === strpos( $pattern['name'], 'modal-kit-pro/' ) ? 'Pro · ' : 'Free · ' ) . $group,
		'content'     => $pattern['content'],
		'settings'    => isset( $settings[ $pattern['name'] ] ) ? $settings[ $pattern['name'] ] : ( isset( $conditions[ $pattern['name'] ] ) ? $conditions[ $pattern['name'] ] : array( 'triggers' => $load( 3 ) ) ),
		'store'       => in_array( $short, $store_starters, true ),
	);
}

/* Pro 1.3 features without a starter of their own --------------------------- */

if ( $pro ) {
	$demos[] = array(
		'slug'        => 'feature-teaser',
		'title'       => 'Teaser',
		'description' => 'A small pill (an edge tab on phones) that stays after the modal is closed and opens it again. × hides it for this visit.',
		'group'       => 'Pro 1.3 features',
		'content'     => Patterns::modal(
			array( 'size' => 's' ),
			array(
				Patterns::heading( 'Spin for 15% off' ),
				Patterns::paragraph( 'Close this, and a teaser stays in the corner to bring it back.' ),
				Patterns::buttons(
					array(
						array(
							'text'   => 'Close',
							'action' => 'close',
						),
					)
				),
			)
		),
		'settings'    => array(
			'triggers'  => $load( 2 ),
			'overrides' => array(
				'teaser' => array(
					'enabled' => true,
					'label'   => 'Spin for 15% off',
				),
			),
		),
	);

	$upload  = wp_upload_bits( 'modal-kit-demo-banner.png', null, (string) file_get_contents( dirname( __DIR__ ) . '/.wordpress-org/banner-1544x500.png' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
	$image   = empty( $upload['error'] ) ? $upload['url'] : '';
	$demos[] = array(
		'slug'        => 'feature-motion',
		'title'       => 'Motion',
		'description' => 'The modal scales in, the blocks inside follow one another, the heading’s words rise, and the picture zooms slowly (Ken Burns) and drifts with the pointer. With reduced motion turned on in your system, everything simply appears.',
		'group'       => 'Pro 1.3 features',
		'content'     => Patterns::modal(
			array( 'size' => 'l' ),
			array(
				'<!-- wp:cover {"url":"' . esc_url( $image ) . '","dimRatio":0,"minHeight":220,"mkMotion":{"kenBurns":true,"parallax":true},"layout":{"type":"constrained"}} --><div class="wp-block-cover" style="min-height:220px"><span aria-hidden="true" class="wp-block-cover__background has-background-dim-0 has-background-dim"></span><img class="wp-block-cover__image-background" alt="" src="' . esc_url( $image ) . '" data-object-fit="cover"/><div class="wp-block-cover__inner-container"><!-- wp:paragraph --><p></p><!-- /wp:paragraph --></div></div><!-- /wp:cover -->',
				'<!-- wp:heading {"mkMotion":{"effect":"words","duration":600}} --><h2 class="wp-block-heading">The autumn journal is here.</h2><!-- /wp:heading -->',
				'<!-- wp:paragraph {"mkMotion":{"effect":"rise","delay":150}} --><p>Lay-flat binding, 120gsm paper, and a ribbon for every month.</p><!-- /wp:paragraph -->',
				Patterns::buttons( array( array( 'text' => 'Shop the journal' ) ) ),
			)
		),
		'settings'    => array(
			'triggers'  => $load( 1 ),
			'overrides' => array(
				'motion' => array(
					'open'      => 'scale',
					'duration'  => 500,
					'stagger'   => true,
					'staggerMs' => 80,
				),
			),
		),
	);

	$demos[] = array(
		'slug'        => 'feature-country',
		'title'       => 'Country rule',
		'description' => 'Shown only to visitors in the United Kingdom or Ireland, read from the CDN’s country header. This local server sends no country header, so the “If unknown” choice (Show) decides.',
		'group'       => 'Pro 1.3 features',
		'content'     => Patterns::modal(
			array( 'size' => 's' ),
			array(
				Patterns::heading( 'Free UK and Ireland delivery' ),
				Patterns::paragraph( 'On every order this week.' ),
				Patterns::buttons(
					array(
						array(
							'text'   => 'Close',
							'action' => 'close',
						),
					)
				),
			)
		),
		'settings'    => array(
			'triggers' => $load( 2 ),
			'rules'    => array(
				'audience' => array(
					'country' => array(
						'mode'    => 'only',
						'codes'   => array( 'GB', 'IE' ),
						'lookup'  => 'auto',
						'unknown' => 'show',
					),
				),
			),
		),
	);

	$demos[] = array(
		'slug'        => 'feature-carousel-on-a-page',
		'title'       => 'Carousel on a page',
		'description' => 'The Carousel block outside a modal: two per view on desktop, 1.2 on phones, with arrows, dots and a counter. Swipe or use ← and → on its slides.',
		'group'       => 'Pro 1.3 features',
		'content'     => '',
		'settings'    => array(),
		'carousel'    => true,
	);
}

/* Pages and modals --------------------------------------------------------- */

list( $index ) = $upsert(
	array(
		'post_type'   => 'page',
		'post_status' => 'publish',
		'post_title'  => 'Modal Kit demos',
		'post_name'   => 'modal-kit-demos',
	)
);

$defaults = Meta::schema( 'rules' )['default'];

// The site-wide limits, as the demo pages describe them.
$general     = \ModalKit\Settings::get( 'general' );
$limit       = (int) $general['autoOpenLimit'];
$cooldown    = (int) $general['cooldown'];
$site_limits = implode(
	' and ',
	array_filter(
		array(
			$limit ? sprintf( 'the site opens at most %s automatically per page', 1 === $limit ? 'one modal' : $limit . ' modals' ) : 'the site has no limit on automatic opens per page',
			$cooldown ? sprintf( 'waits %d seconds between them', $cooldown ) : '',
		)
	)
);
$listing  = array();
$order    = 0;

foreach ( $demos as $demo ) {
	list( $page ) = $upsert(
		array(
			'post_type'   => 'page',
			'post_status' => 'publish',
			'post_title'  => $demo['title'],
			'post_name'   => $demo['slug'],
			'post_parent' => $index,
			'menu_order'  => ++$order,
		)
	);

	$content = $demo['content'];

	// Games draw fixed demo codes in the browser, so a reload plays again.
	$content = preg_replace_callback(
		'#<!-- wp:modal-kit/(prize-wheel|scratch-card|pick-a-gift|slot-reel) (\{.*?\}) /-->#',
		static function ( $found ) {
			$attrs = json_decode( $found[2], true );

			foreach ( isset( $attrs['prizes'] ) ? $attrs['prizes'] : array() as $i => $prize ) {
				if ( 'none' !== $prize['reward'] && 'message' !== $prize['reward'] ) {
					$attrs['prizes'][ $i ]['reward'] = 'code';
					$attrs['prizes'][ $i ]['code']   = 'DEMO-' . strtoupper( preg_replace( '/[^a-z0-9]/i', '', $prize['id'] ) );
				}
			}

			$attrs['onePer'] = 'visitor';

			return '<!-- wp:modal-kit/' . $found[1] . ' ' . wp_json_encode( $attrs ) . ' /-->';
		},
		$content
	);

	// Add-to-cart buttons get the demo products.
	if ( $product_ids ) {
		$content = str_replace( '"modalKitAction":"woo-add-to-cart"', '"modalKitAction":"woo-add-to-cart","modalKitProducts":"' . $product_ids[1] . '"', $content );
	}

	$dom_id = '';
	$facts  = array();
	$hints  = array();

	if ( '' !== $content ) {
		$rules                      = Meta::merge_defaults( isset( $demo['settings']['rules'] ) ? $demo['settings']['rules'] : array(), $defaults );
		$rules['showOn']['mode']    = 'include';
		$rules['showOn']['include'] = array( 'post:' . $page );
		$triggers                   = isset( $demo['settings']['triggers'] ) ? $demo['settings']['triggers'] : array();

		list( $modal, $edited ) = $upsert(
			array(
				'post_type'    => PostType::NAME,
				'post_status'  => 'publish',
				'post_title'   => $demo['title'],
				'post_name'    => 'demo-' . $demo['slug'],
				'post_content' => $content,
			)
		);
		if ( $edited ) {
			WP_CLI::log( sprintf( 'Kept "%s": edited since the last run.', $demo['title'] ) );
		} else {
			update_post_meta( $modal, '_modal_kit_triggers', $triggers );
			update_post_meta( $modal, '_modal_kit_rules', $rules );
			update_post_meta( $modal, '_modal_kit_overrides', ! empty( $demo['settings']['overrides'] ) ? $demo['settings']['overrides'] : array() );
		}

		$post   = get_post( $modal );
		$dom_id = 'modal-' . $post->post_name;

		$facts[] = '<strong>Layout:</strong> ' . esc_html( ModalList::layout_label( $post ) );
		$facts[] = '<strong>Opens:</strong> ' . esc_html( $triggers ? ModalList::triggers_summary( $post ) : 'From a link or button only (like Open it now below).' );

		if ( $pro ) {
			$facts[] = '<strong>Who sees it:</strong> ' . esc_html( \ModalKit\Pro\Audience::summary( $rules ) );
		}

		$facts[] = '<strong>Shown on:</strong> this page only.';

		foreach ( $triggers as $trigger ) {
			switch ( $trigger['type'] ) {
				case 'load':
					$hints[] = $trigger['delay'] ? sprintf( 'It opens %d seconds after the page loads.', $trigger['delay'] ) : 'It opens as soon as the page loads.';
					break;
				case 'scroll':
					$hints[] = sprintf( 'Scroll down the page: it opens at %d%%.', $trigger['percent'] );
					break;
				case 'time':
					$hints[] = sprintf( 'Stay on the site for %d seconds.', $trigger['delay'] );
					break;
				case 'exit':
					$hints[] = 'Move the pointer up out of the window, as if to leave (on a phone, scroll back up quickly).';
					break;
				case 'woo-added':
					$hints[] = 'Add a product to the cart below.';
					break;
				case 'woo-in-cart':
					$hints[] = 'Add the Autumn journal to the cart below.';
					break;
				case 'woo-quick-view':
					$hints[] = 'Press Quick view on a product below.';
					break;
			}
		}

		$audience = isset( $rules['audience'] ) ? $rules['audience'] : array();

		if ( isset( $audience['visitors'] ) && 'returning' === $audience['visitors'] ) {
			$hints[] = 'It only opens on a return visit (after 30 minutes away). Reload the demo makes you a new visitor, so use Open it now to see it.';
		}

		if ( isset( $audience['visitors'] ) && 'new' === $audience['visitors'] ) {
			$hints[] = 'It only opens for new visitors: Reload the demo makes you one again.';
		}

		if ( isset( $audience['referrer']['mode'] ) && 'search' === $audience['referrer']['mode'] ) {
			$hints[] = 'It only opens when you arrive from a search engine, so use Open it now to see it.';
		}

		if ( ! empty( $rules['schedule']['days'] ) && count( $rules['schedule']['days'] ) < 7 ) {
			$hints[] = 'It only opens on the days set in its schedule (site time). On other days, use Open it now.';
		}

		if ( isset( $rules['shop']['cart'] ) && 'not-empty' === $rules['shop']['cart'] ) {
			$hints[] = 'It waits until something is in the cart: add a product below first.';
		}

		if ( false !== strpos( $content, '"modalLayout":"age-gate"' ) ) {
			$hints[] = 'An age gate opens at once and can’t be closed until you answer. Reload the demo forgets your answer.';
		}

		if ( preg_match( '#wp:modal-kit/(prize-wheel|scratch-card|pick-a-gift|slot-reel)#', $content ) ) {
			$hints[] = 'One play per visitor, remembered in your browser. Reload the demo lets you play again. Prizes are demo codes.';
		}
	} else {
		$facts[] = '<strong>No modal:</strong> the block sits in the page itself.';
	}

	$blocks   = array();
	$blocks[] = $p( esc_html( $demo['description'] ) );
	$blocks[] = $h( 'How it’s set up', 3 );
	$blocks[] = $items( $facts );
	$blocks[] = $h( 'Try it', 3 );

	if ( $hints ) {
		$blocks[] = $items( array_map( 'esc_html', array_unique( $hints ) ) );
	}

	$blocks[] = $p( 'Reload the demo clears what your browser remembers about modals and loads this page again, as a first-time visitor sees it. That matters here: ' . esc_html( $site_limits ) . ' (Settings → General), so coming straight from another demo can hold this one back. Open it now opens the modal straight away: links always work, whatever the rules say.' );
	$blocks[] = $actions( $dom_id );

	if ( ! empty( $demo['carousel'] ) && $pro ) {
		$slide    = static function ( $title, $text ) {
			return \ModalKit\Pro\Templates::slide( array( \ModalKit\Pro\Templates::photo( 'Photo' ), Patterns::heading( $title, array( 'level' => 3 ) ), Patterns::paragraph( $text ) ) );
		};
		$blocks[] = \ModalKit\Pro\Templates::carousel(
			array(
				'perView'       => 2,
				'perViewMobile' => 1.2,
				'counter'       => true,
				'label'         => 'Notebooks',
			),
			array(
				$slide( 'Autumn journal', 'Lay-flat binding.' ),
				$slide( 'Copper pen clip', 'Fits any cover.' ),
				$slide( 'Linen sketchbook', 'Heavy paper.' ),
				$slide( 'Desk tray', 'Keeps pens together.' ),
				$slide( 'Pocket notebook', 'For your bag.' ),
			)
		);
	}

	if ( ! empty( $demo['store'] ) ) {
		$blocks[] = $products_block;
	}

	if ( $hints && preg_grep( '/Scroll down/', $hints ) ) {
		$blocks[] = $p( 'Keep scrolling…' );
		$blocks[] = $spacer( 1600 );
		$blocks[] = $p( 'The end of the demo page.' );
	}

	$blocks[] = $p( '<a href="' . esc_url( get_permalink( $index ) ) . '">← All demos</a>' );

	wp_update_post(
		array(
			'ID'           => $page,
			'post_content' => implode( "\n\n", $blocks ),
		)
	);

	$listing[ $demo['group'] ][] = '<a href="' . esc_url( get_permalink( $page ) ) . '">' . esc_html( $demo['title'] ) . '</a>' . ( $demo['description'] ? ': ' . esc_html( $demo['description'] ) : '' );
}

/* All at once: several modals on one page, with no limit -------------------- */

// Copies of other demos with their triggers spread out. Bars and corners
// don't block the page, so they open alongside the others; a blocking modal
// (split, drawer, full screen) skips a trigger while another one is open.
$by_slug = array_column( $demos, null, 'slug' );
$lineup  = array(
	array( 'countdown-bar', 'Countdown bar', 'top', $load( 0 ), 'A bar along the top, as soon as the page loads.' ),
	array( 'order-feedback', 'Order feedback', 'bottom-right', $load( 2 ), 'A corner note, bottom right, after 2 seconds.' ),
	array( 'discount-code', 'Discount code', '', $load( 6 ), 'A split modal after 6 seconds. The bar and the corner stay.' ),
	array( 'event-announcement', 'Event announcement', 'right', $scroll( 30 ), 'A drawer from the right when you scroll to 30%.' ),
	array( 'product-drop', 'Product drop', 'bottom-left', $scroll( 70 ), 'A second corner, bottom left, at 70%.' ),
	array( 'parting-gift', 'Parting gift', '', $leave, 'Full screen when you move the pointer out of the window.' ),
);

list( $together ) = $upsert(
	array(
		'post_type'   => 'page',
		'post_status' => 'publish',
		'post_title'  => 'All at once',
		'post_name'   => 'all-at-once',
		'post_parent' => $index,
		'menu_order'  => 0,
	)
);
update_post_meta( $together, '_modal_kit_demo_unlimited', 1 );

$steps   = array();
$openers = array();

foreach ( $lineup as $entry ) {
	list( $slug, $title, $position, $triggers, $step ) = $entry;

	if ( ! isset( $by_slug[ $slug ] ) || '' === $by_slug[ $slug ]['content'] ) {
		continue;
	}

	$blocks = parse_blocks( $by_slug[ $slug ]['content'] );

	foreach ( $blocks as $i => $block ) {
		if ( 'modal-kit/modal' === $block['blockName'] && $position ) {
			$blocks[ $i ]['attrs']['position'] = $position;
		}
	}

	$rules                      = Meta::merge_defaults( array(), $defaults );
	$rules['showOn']['mode']    = 'include';
	$rules['showOn']['include'] = array( 'post:' . $together );

	list( $modal, $edited ) = $upsert(
		array(
			'post_type'    => PostType::NAME,
			'post_status'  => 'publish',
			'post_title'   => $title . ' (all at once)',
			'post_name'    => 'demo-all-' . $slug,
			'post_content' => serialize_blocks( $blocks ),
		)
	);

	if ( ! $edited ) {
		update_post_meta( $modal, '_modal_kit_triggers', $triggers );
		update_post_meta( $modal, '_modal_kit_rules', $rules );
		update_post_meta( $modal, '_modal_kit_overrides', array() );
	}

	$steps[]   = '<strong>' . esc_html( $title ) . ':</strong> ' . esc_html( $step );
	$openers[] = '<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" style="background:transparent;color:inherit;border:2px solid currentColor" href="#modal-demo-all-' . esc_attr( $slug ) . '">' . esc_html( $title ) . '</a></div>';
}

$blocks = array(
	$p( 'Several modals on one page, each opening on its own trigger. Everywhere else, ' . esc_html( $site_limits ) . ' (Settings → General → Auto-open limit and Cool-down). This page lifts both, as if the limit were set to No limit and the cool-down to 0.' ),
	$h( 'What opens, and when', 3 ),
	$items( $steps ),
	$h( 'Try it', 3 ),
	$items(
		array(
			'Wait on the page: the bar, the corner note, then the split modal open on their own.',
			'Close the split modal, then scroll down slowly for the drawer and the second corner.',
			'Move the pointer up out of the window for the full-screen one.',
			'Bars and corners don’t block the page, so they stay open alongside the others. Automatic triggers don’t queue: while a modal that blocks the page is open, any trigger that fires is skipped, so close each one before moving on.',
		)
	),
	$p( 'Reload the demo clears what your browser remembers about modals and loads this page again. Each modal also has a button below that opens it straight away.' ),
	$actions( '' ),
	'<!-- wp:html --><div class="wp-block-buttons is-layout-flex" style="display:flex;flex-wrap:wrap;gap:12px">' . implode( '', $openers ) . '</div><!-- /wp:html -->',
	$p( 'Keep scrolling…' ),
	$spacer( 1200 ),
	$p( 'Halfway…' ),
	$spacer( 1200 ),
	$p( 'The end of the demo page.' ),
	$p( '<a href="' . esc_url( get_permalink( $index ) ) . '">← All demos</a>' ),
);

wp_update_post(
	array(
		'ID'           => $together,
		'post_content' => implode( "\n\n", $blocks ),
	)
);

// The page's limits are lifted by a small must-use plugin on this site.
wp_mkdir_p( WPMU_PLUGIN_DIR );
copy( __DIR__ . '/demos-mu-plugin.php', WPMU_PLUGIN_DIR . '/modal-kit-demos.php' );

/* The index ---------------------------------------------------------------- */

ksort( $listing );
$blocks = array(
	$p( 'Every Modal Kit starter and Pro feature, each with real conditions on a page of its own. Each page explains when its modal opens and has a Reload the demo button.' ),
	$p( '<strong><a href="' . esc_url( get_permalink( $together ) ) . '">All at once</a></strong>: six modals on one page (bar, corners, split, drawer and full screen) with no auto-open limit or cool-down.' ),
);

foreach ( $listing as $group => $lines ) {
	$blocks[] = $h( $group );
	$blocks[] = $items( $lines );
}

wp_update_post(
	array(
		'ID'           => $index,
		'post_content' => implode( "\n\n", $blocks ),
	)
);

$removed = 0;

foreach ( $existing as $existing_post ) {
	if ( empty( $kept[ $existing_post->ID ] ) ) {
		wp_delete_post( $existing_post->ID, true );
		++$removed;
	}
}

if ( $removed ) {
	WP_CLI::log( sprintf( 'Removed %d demo posts that are no longer in the list.', $removed ) );
}

if ( $pro ) {
	\ModalKit\Pro\Audience::refresh_geo_flag();
}

WP_CLI::success( sprintf( '%d demos under %s', count( $demos ), get_permalink( $index ) ) );

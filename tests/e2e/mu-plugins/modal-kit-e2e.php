<?php
/**
 * Plugin Name: Modal Kit e2e helpers
 * Description: Test-site only. Answers YouTube and Vimeo oEmbed lookups locally, so the e2e suite needs no network.
 *
 * @package ModalKit
 */

defined( 'ABSPATH' ) || exit;

// tests/e2e/rtl.spec.js: a right-to-left site without a language pack.
add_action(
	'init',
	static function () {
		if ( isset( $_COOKIE['modal_kit_e2e_rtl'] ) ) {
			$GLOBALS['wp_locale']->text_direction = 'rtl';
		}
	},
	0
);

add_filter(
	'pre_oembed_result',
	static function ( $result, $url ) {
		if ( preg_match( '#(?:youtu\.be/|youtube\.com/watch\?v=)([\w-]+)#', $url, $match ) ) {
			return '<iframe title="Test video" width="640" height="360" src="https://www.youtube.com/embed/' . esc_attr( $match[1] ) . '?feature=oembed" frameborder="0" allowfullscreen></iframe>';
		}

		if ( preg_match( '#vimeo\.com/(\d+)#', $url, $match ) ) {
			return '<iframe title="Test video" width="640" height="360" src="https://player.vimeo.com/video/' . esc_attr( $match[1] ) . '" frameborder="0" allowfullscreen></iframe>';
		}

		return $result;
	},
	10,
	2
);

/*
 * Modal Kit Pro: fake email services and webhooks, so form tests need no
 * network. Kit accepts the key "kit-e2e-key", Mailchimp "mc-e2e-key-us21".
 * Webhook addresses on hooks.example containing "fail" answer 500.
 */
add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		$host = (string) wp_parse_url( $url, PHP_URL_HOST );
		$path = (string) wp_parse_url( $url, PHP_URL_PATH );
		$json = static function ( $code, $body ) {
			return array(
				'headers'  => array( 'content-type' => 'application/json' ),
				'body'     => wp_json_encode( $body ),
				'response' => array(
					'code'    => $code,
					'message' => 200 === $code ? 'OK' : 'Error',
				),
				'cookies'  => array(),
			);
		};

		if ( 'api.kit.com' === $host ) {
			if ( 'kit-e2e-key' !== ( $args['headers']['X-Kit-Api-Key'] ?? '' ) ) {
				return $json( 401, array( 'errors' => array( 'The API key is invalid' ) ) );
			}

			if ( false !== strpos( $path, '/forms' ) ) {
				return $json(
					200,
					array(
						'forms' => array(
							array(
								'id'   => 1234,
								'name' => 'Welcome offer signup',
							),
						),
					)
				);
			}

			if ( false !== strpos( $path, '/tags' ) ) {
				return $json(
					200,
					array(
						'tags' => array(
							array(
								'id'   => 55,
								'name' => 'welcome-15',
							),
						),
					)
				);
			}

			return $json( 200, array( 'account' => array( 'name' => 'Fieldnote' ) ) );
		}

		if ( preg_match( '/\.api\.mailchimp\.com$/', $host ) ) {
			if ( 'Basic ' . base64_encode( 'modal-kit:mc-e2e-key-us21' ) !== ( $args['headers']['Authorization'] ?? '' ) ) { // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
				return $json( 401, array( 'detail' => 'Your API key may be invalid.' ) );
			}

			if ( false !== strpos( $path, '/lists' ) ) {
				return $json(
					200,
					array(
						'lists' => array(
							array(
								'id'   => 'list9',
								'name' => 'Field Notes',
							),
						),
					)
				);
			}

			return $json( 200, array( 'account_id' => 'acc1' ) );
		}

		if ( 'app.kit.com' === $host ) {
			return $json( 200, array( 'status' => 'success' ) );
		}

		// GetResponse: key "gr-e2e-key"; one list, one tag; contacts queued.
		if ( 'api.getresponse.com' === $host ) {
			if ( 'api-key gr-e2e-key' !== ( $args['headers']['X-Auth-Token'] ?? '' ) ) {
				return $json(
					401,
					array(
						'code'    => 1014,
						'message' => 'Unable to authenticate',
					)
				);
			}

			if ( false !== strpos( $path, '/campaigns' ) ) {
				return $json(
					200,
					array(
						array(
							'campaignId' => 'gr1',
							'name'       => 'field_notes',
						),
					)
				);
			}

			if ( false !== strpos( $path, '/tags' ) ) {
				return $json(
					200,
					array(
						array(
							'tagId' => 'grt1',
							'name'  => 'popup',
						),
					)
				);
			}

			return false !== strpos( $path, '/contacts' ) ? $json( 202, array() ) : $json( 200, array( 'accountId' => 'gra' ) );
		}

		// Emma: account 1001 with keys "pub" / "priv".
		if ( 'api.e2ma.net' === $host ) {
			if ( 'Basic ' . base64_encode( 'pub:priv' ) !== ( $args['headers']['Authorization'] ?? '' ) || 0 !== strpos( $path, '/1001/' ) ) { // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
				return $json( 401, array( 'error' => 'Unauthorized' ) );
			}

			return false !== strpos( $path, '/members/signup' )
				? $json(
					200,
					array(
						'member_id' => 9,
						'status'    => 'o',
					)
				)
				: $json(
					200,
					array(
						array(
							'member_group_id' => 77,
							'group_name'      => 'Readers',
						),
					)
				);
		}

		// HubSpot: token "hs-e2e-token", account 4455, one form.
		if ( 'api.hubapi.com' === $host ) {
			if ( 'Bearer hs-e2e-token' !== ( $args['headers']['Authorization'] ?? '' ) ) {
				return $json( 401, array( 'message' => 'Authentication credentials not found.' ) );
			}

			return false !== strpos( $path, '/forms' )
				? $json(
					200,
					array(
						'results' => array(
							array(
								'id'   => 'f00d-cafe',
								'name' => 'Newsletter',
							),
						),
					)
				)
				: $json( 200, array( 'portalId' => 4455 ) );
		}

		if ( 'hooks.example' === $host ) {
			return false !== strpos( $url, 'fail' ) ? $json( 500, array() ) : $json( 200, array( 'ok' => true ) );
		}

		if ( 'challenges.cloudflare.com' === $host ) {
			return $json( 200, array( 'success' => 'e2e-token' === ( $args['body']['response'] ?? '' ) ) );
		}

		return $pre;
	},
	10,
	3
);

// WooCommerce: the store is open (no "Coming soon" page) and never
// redirects to its onboarding wizard.
add_filter(
	'pre_option_woocommerce_coming_soon',
	static function () {
		return 'no';
	}
);
add_filter( 'woocommerce_enable_setup_wizard', '__return_false' );
add_filter( 'woocommerce_prevent_automatic_wizard_redirect', '__return_true' );

/*
 * Modal Kit Pro licensing: a fake license API on modalkitwp.com (key
 * "MK-PRO-E2E" works, "MK-FULL" has no sites left) and a fake update
 * endpoint offering 9.9.9, with 0.0.9 to roll back to.
 */

// Never install a rollback here: the plugins are linked to the repo.
add_filter(
	'modal_kit_pro_pre_rollback',
	static function () {
		return true;
	}
);
add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		$host = (string) wp_parse_url( $url, PHP_URL_HOST );
		$json = static function ( $code, $body ) {
			return array(
				'headers'  => array(),
				'body'     => wp_json_encode( $body ),
				'response' => array(
					'code'    => $code,
					'message' => '',
				),
				'cookies'  => array(),
			);
		};

		if ( 'modalkitwp.com' === $host && false !== strpos( $url, '/license-keys/' ) ) {
			$body    = json_decode( (string) $args['body'], true );
			$license = array(
				'status'            => 'granted',
				'display_key'       => 'MK-PRO-****-E2E',
				'limit_activations' => 1,
				'expires_at'        => '2027-10-10T00:00:00Z',
			);

			if ( str_ends_with( $url, '/deactivate' ) ) {
				return $json( 204, array() );
			}

			if ( 'MK-FULL' === ( $body['key'] ?? '' ) ) {
				return $json( 403, array( 'error' => 'NotPermitted' ) );
			}

			if ( 'MK-PRO-E2E' !== ( $body['key'] ?? '' ) ) {
				return $json( 404, array( 'error' => 'ResourceNotFound' ) );
			}

			return str_ends_with( $url, '/activate' )
				? $json(
					200,
					array(
						'id'          => 'e2e-activation',
						'license_key' => $license,
					)
				)
				: $json( 200, $license );
		}

		if ( 'modalkitwp.com' === $host ) {
			return $json(
				200,
				array(
					'version'       => '9.9.9',
					'download_link' => 'https://modalkitwp.com/e2e.zip',
					'versions'      => array(
						'0.0.9' => 'https://modalkitwp.com/e2e-0.0.9.zip',
						'9.9.9' => 'https://modalkitwp.com/e2e.zip',
					),
				)
			);
		}

		return $pre;
	},
	10,
	3
);

/*
 * Modal Kit Pro bot checks (P11): the providers' `siteverify`, answered
 * locally. The published test secrets pass (Turnstile's "2x" secret fails),
 * as their real services would. reCAPTCHA v3 has no test key: the e2e suite
 * serves a fake Google script whose tokens read "e2e-v3:{action}:{score}".
 */
add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		if ( ! preg_match( '#^https://(challenges\.cloudflare\.com/turnstile/v0|api\.hcaptcha\.com|www\.google\.com/recaptcha/api)/siteverify$#', $url ) ) {
			return $pre;
		}

		$body   = (array) $args['body'];
		$token  = (string) ( $body['response'] ?? '' );
		$secret = (string) ( $body['secret'] ?? '' );
		$answer = array( 'success' => false );

		if ( preg_match( '/^e2e-v3:(\w+):([\d.]+)$/', $token, $match ) && 'v3-e2e-secret' === $secret ) {
			$answer = array(
				'success'  => true,
				'hostname' => (string) wp_parse_url( home_url(), PHP_URL_HOST ),
				'action'   => $match[1],
				'score'    => (float) $match[2],
			);
		} elseif ( '' !== $token && in_array( $secret, array( '1x0000000000000000000000000000000AA', '0x0000000000000000000000000000000000000000', '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe' ), true ) ) { // phpcs:ignore PHPCompatibility.Miscellaneous.ValidIntegers.HexNumericStringFound -- A key, not a number.
			$answer = array(
				'success'  => true,
				'hostname' => 'test.example',
			);
		}

		return array(
			'headers'  => array(),
			'body'     => wp_json_encode( $answer ),
			'response' => array(
				'code'    => 200,
				'message' => 'OK',
			),
			'cookies'  => array(),
		);
	},
	10,
	3
);

/*
 * Modal Kit Pro A/B tests: seeds daily totals per variant, so the e2e suite
 * can show every result state without sending thousands of events.
 */
add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'modal-kit-e2e/v1',
			'/ab-seed',
			array(
				'methods'             => 'POST',
				'permission_callback' => static function () {
					return current_user_can( 'manage_options' );
				},
				'callback'            => static function ( WP_REST_Request $request ) {
					if ( ! class_exists( '\ModalKit\Pro\Results' ) ) {
						return new WP_Error( 'no_pro', 'Modal Kit Pro is off.', array( 'status' => 400 ) );
					}

					$modal = (int) $request['modal'];
					$round = (int) ( $request['round'] ?? 1 );
					$goal  = (string) ( $request['goal'] ?? 'signed_up' );

					foreach ( (array) $request['totals'] as $letter => $totals ) {
						\ModalKit\Pro\Results::record( $modal, 'shown', '', (int) $totals['shown'], '', (string) $letter, $round );
						\ModalKit\Pro\Results::record( $modal, 'converted', $goal, (int) $totals['converted'], '', (string) $letter, $round );
					}

					return array( 'seeded' => true );
				},
			)
		);
	}
);

// The Pro suites send far more than one visitor would, and rerun within the hour.
foreach ( array( 'modal_kit_pro_events_rate_limit', 'modal_kit_pro_play_rate_limit', 'modal_kit_pro_address_daily_limit' ) as $modal_kit_e2e_limit ) {
	add_filter(
		$modal_kit_e2e_limit,
		static function () {
			return 1000000;
		}
	);
}

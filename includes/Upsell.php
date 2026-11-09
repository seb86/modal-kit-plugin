<?php
/**
 * Pro listings and upgrade prompts.
 *
 * @package ModalKit
 */

namespace ModalKit;

defined( 'ABSPATH' ) || exit;

/**
 * Pro features shown as plain listings in the free plugin's own screens.
 * There is no Pro code here: the Pro add-on filters modal_kit_pro_listings
 * to remove the listings it replaces with real controls.
 *
 * Prompts appear only on Modal Kit's screens and block, can be dismissed
 * ("Not now" for 30 days, per user), and one setting hides them all.
 */
final class Upsell {

	/**
	 * Pro page on the product site.
	 */
	const PRO_URL = 'https://github.com/seb86/modal-kit-plugin/';

	/**
	 * User meta: listing key => dismissed-until timestamp.
	 */
	const DISMISSED = 'modal_kit_dismissed';

	/**
	 * "Not now" lasts 30 days.
	 */
	const SNOOZE = 30 * DAY_IN_SECONDS;

	/**
	 * Listings that are hidden for good once dismissed.
	 */
	const PERMANENT = array( 'milestone', 'forms-panel' );

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'init', array( $this, 'register_meta' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( MODAL_KIT_FILE ), array( $this, 'plugin_link' ), 20 );
		add_action( 'admin_notices', array( $this, 'milestone_notice' ) );
		add_filter( 'rest_prepare_user', array( $this, 'private_dismissals' ), 10, 2 );
	}

	/**
	 * Per-user dismissals, editable by the user through REST.
	 *
	 * @return void
	 */
	public function register_meta() {
		register_meta(
			'user',
			self::DISMISSED,
			array(
				'type'              => 'object',
				'single'            => true,
				'default'           => array(),
				'sanitize_callback' => array( __CLASS__, 'sanitize_dismissed' ),
				'auth_callback'     => static function ( $allowed, $meta_key, $user_id ) {
					return get_current_user_id() === (int) $user_id;
				},
				'show_in_rest'      => array(
					'schema' => array(
						'type'                 => 'object',
						'additionalProperties' => array( 'type' => 'integer' ),
					),
				),
			)
		);
	}

	/**
	 * Core shows registered user meta to anyone who can read the user: a user's
	 * dismissals are only for that user.
	 *
	 * @param \WP_REST_Response $response Response.
	 * @param \WP_User          $user     User.
	 * @return \WP_REST_Response
	 */
	public function private_dismissals( $response, $user ) {
		$data = $response->get_data();

		if ( get_current_user_id() !== (int) $user->ID && isset( $data['meta'][ self::DISMISSED ] ) ) {
			unset( $data['meta'][ self::DISMISSED ] );
			$response->set_data( $data );
		}

		return $response;
	}

	/**
	 * Keeps only key => integer pairs.
	 *
	 * @param mixed $value Raw value.
	 * @return array<string, int>
	 */
	public static function sanitize_dismissed( $value ) {
		$clean = array();

		foreach ( is_array( $value ) ? $value : array() as $key => $until ) {
			$clean[ sanitize_key( (string) $key ) ] = (int) $until;
		}

		return $clean;
	}

	/**
	 * Whether the current user dismissed a listing (and it hasn't expired).
	 *
	 * @param string $key Listing key.
	 * @return bool
	 */
	public static function is_dismissed( $key ) {
		$dismissed = get_user_meta( get_current_user_id(), self::DISMISSED, true );

		return is_array( $dismissed ) && isset( $dismissed[ $key ] ) && (int) $dismissed[ $key ] > time();
	}

	/**
	 * Whether Pro tips are shown (Settings → Pro).
	 *
	 * @return bool
	 */
	public static function show_tips() {
		return (bool) Settings::value( 'pro', 'showProTips' );
	}

	/**
	 * Every listing, before filtering.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function all() {
		$multi_step = __( 'Make this button go to another step, so you can build offer → email → thank-you flows inside one modal.', 'modal-kit' );
		$forms      = __( 'Collect emails right in the modal and send them to Kit, Mailchimp, HubSpot, GetResponse, Constant Contact, Keap, MailerLite, Brevo, Emma, MailPoet, FluentCRM, WPForms or a webhook.', 'modal-kit' );

		$listings = array(
			// The Button "Action" setting.
			array(
				'key'         => 'step-nav',
				'area'        => 'button-action',
				'label'       => __( 'Next / previous step', 'modal-kit' ),
				'title'       => __( 'Multi-step modals', 'modal-kit' ),
				'description' => $multi_step,
				'url'         => self::PRO_URL . '#multi-step',
			),
			array(
				'key'         => 'go-to-step',
				'area'        => 'button-action',
				'label'       => __( 'Go to step', 'modal-kit' ),
				'title'       => __( 'Multi-step modals', 'modal-kit' ),
				'description' => $multi_step,
				'url'         => self::PRO_URL . '#multi-step',
			),
			array(
				'key'         => 'submit-form',
				'area'        => 'button-action',
				'label'       => __( 'Submit form', 'modal-kit' ),
				'title'       => __( 'Forms', 'modal-kit' ),
				'description' => $forms,
				'url'         => self::PRO_URL . '#forms',
			),
			// Pro collections in the pattern picker.
			array(
				'key'     => 'collections',
				'area'    => 'picker',
				'url'     => self::PRO_URL . '#templates',
				'compare' => self::PRO_URL . '#compare',
				// The number of templates in each Pro collection.
				'groups'  => array(
					array(
						'name'  => __( 'Events', 'modal-kit' ),
						'count' => 2,
					),
					array(
						'name'  => __( 'Games', 'modal-kit' ),
						'count' => 4,
					),
					array(
						'name'  => __( 'Popups', 'modal-kit' ),
						'count' => 27,
					),
					array(
						'name'  => __( 'Shop', 'modal-kit' ),
						'count' => 9,
					),
					array(
						'name'  => __( 'Studio', 'modal-kit' ),
						'count' => 4,
					),
				),
				'samples' => array(
					array(
						'title'     => __( 'Welcome offer', 'modal-kit' ),
						'layout'    => 'centered',
						'text'      => __( 'Want 15% off your first order?', 'modal-kit' ),
						'button'    => __( 'Yes, please', 'modal-kit' ),
						'uses'      => __( 'Uses Multi-step and Form, which come with Modal Kit Pro.', 'modal-kit' ),
						'lookalike' => 'modal-kit/monthly-letter',
						'note'      => __( 'Monthly letter (one step, button links to your signup page)', 'modal-kit' ),
					),
					array(
						'title'     => __( 'Added-to-cart drawer', 'modal-kit' ),
						'layout'    => 'drawer',
						'text'      => __( 'Added to your cart ✓', 'modal-kit' ),
						'button'    => __( 'Checkout', 'modal-kit' ),
						'uses'      => __( 'Uses WooCommerce blocks and cart triggers, which come with Modal Kit Pro.', 'modal-kit' ),
						'lookalike' => 'modal-kit/event-announcement',
						'note'      => __( 'Event announcement (a drawer with a link to your cart)', 'modal-kit' ),
					),
					array(
						'title'     => __( 'Countdown bar', 'modal-kit' ),
						'layout'    => 'bar',
						'text'      => __( 'Sale ends in 02:14:33', 'modal-kit' ),
						'button'    => __( 'Shop now', 'modal-kit' ),
						'uses'      => __( 'Uses the Countdown block, which comes with Modal Kit Pro.', 'modal-kit' ),
						'lookalike' => 'modal-kit/shipping-notice',
						'note'      => __( 'Shipping notice (a bar without the timer)', 'modal-kit' ),
					),
					array(
						'title'     => __( 'Quick view', 'modal-kit' ),
						'layout'    => 'split',
						'text'      => __( 'Field Notebook, A5', 'modal-kit' ),
						'button'    => __( 'Add to cart', 'modal-kit' ),
						'uses'      => __( 'Uses WooCommerce product blocks, which come with Modal Kit Pro.', 'modal-kit' ),
						'lookalike' => 'modal-kit/discount-code',
						'note'      => __( 'Discount code (a split layout that links to the product)', 'modal-kit' ),
					),
				),
			),
			// The Forms panel in the Modal sidebar.
			array(
				'key'         => 'forms-panel',
				'area'        => 'panel',
				'title'       => __( 'Forms', 'modal-kit' ),
				'description' => $forms,
				'url'         => self::PRO_URL . '#forms',
			),
			// Display rules: Pro's visit count and audience rules.
			array(
				'key'         => 'audience-rules',
				'area'        => 'rules',
				'title'       => __( 'Wait for a returning visitor', 'modal-kit' ),
				'description' => __( 'Show it from a visitor’s 2nd, 3rd or later visit (session), or only to new visitors, by referrer, cookie or country.', 'modal-kit' ),
				'url'         => self::PRO_URL . '#audience',
			),
			// Settings → Styles: Pro's Style editor.
			array(
				'key'         => 'style-editor',
				'area'        => 'styles',
				'title'       => __( 'Style editor', 'modal-kit' ),
				'description' => __( 'Change a style’s colours, fonts, corners and shadow with a live preview, or start a new style from scratch.', 'modal-kit' ),
				'url'         => self::PRO_URL . '#style-editor',
			),
			// One milestone notice on the modal list.
			array(
				'key'  => 'milestone',
				'area' => 'notice',
				'url'  => self::PRO_URL,
			),
		);

		// WooCommerce triggers only appear on sites with a store.
		if ( class_exists( 'WooCommerce' ) ) {
			$listings[] = array(
				'key'         => 'woo-triggers',
				'area'        => 'trigger',
				'title'       => __( 'WooCommerce · detected', 'modal-kit' ),
				'items'       => array(
					__( 'Added to cart', 'modal-kit' ),
					__( 'Cart total over…', 'modal-kit' ),
					__( 'Product or category in cart', 'modal-kit' ),
				),
				'description' => __( 'Open this modal when the cart passes an amount, e.g. a free-shipping nudge at $30.', 'modal-kit' ),
				'url'         => self::PRO_URL . '#woocommerce',
			);
		}

		return $listings;
	}

	/**
	 * Listings for one area of the UI (or all), without the ones the current
	 * user dismissed. Empty when Pro tips are turned off.
	 *
	 * @param string|null $area button-action | picker | trigger | panel | rules | styles | notice (null for all).
	 * @return array<int, array<string, mixed>>
	 */
	public static function listings( $area = null ) {
		if ( ! self::show_tips() ) {
			return array();
		}

		/**
		 * Filters the Pro listings shown in the free plugin's screens. The Pro
		 * add-on removes the ones it provides.
		 *
		 * @param array<int, array<string, mixed>> $listings Listings.
		 */
		$listings = (array) apply_filters( 'modal_kit_pro_listings', self::all() );

		return array_values(
			array_filter(
				$listings,
				static function ( $listing ) use ( $area ) {
					return ( null === $area || ( isset( $listing['area'] ) && $area === $listing['area'] ) )
						&& ! self::is_dismissed( (string) $listing['key'] );
				}
			)
		);
	}

	/**
	 * Current user's dismissals, for the editor.
	 *
	 * @return array<string, int>
	 */
	public static function dismissed() {
		$dismissed = get_user_meta( get_current_user_id(), self::DISMISSED, true );

		return is_array( $dismissed ) ? self::sanitize_dismissed( $dismissed ) : array();
	}

	/**
	 * One "Go Pro" link on the Plugins screen.
	 *
	 * @param array<string, string> $links Links.
	 * @return array<string, string>
	 */
	public function plugin_link( $links ) {
		if ( ! self::show_tips() || defined( 'MODAL_KIT_PRO_VERSION' ) ) {
			return $links;
		}

		$links['go_pro'] = '<a href="' . esc_url( self::PRO_URL ) . '" target="_blank" rel="noopener">' . esc_html__( 'Go Pro', 'modal-kit' ) . '</a>';

		return $links;
	}

	/**
	 * The only notice: on the modal list, once three modals are live.
	 *
	 * @return void
	 */
	public function milestone_notice() {
		$screen = get_current_screen();

		if ( ! $screen || 'edit-' . PostType::NAME !== $screen->id || ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( ! self::listings( 'notice' ) || (int) wp_count_posts( PostType::NAME )->publish < 3 ) {
			return;
		}

		printf(
			'<div class="notice notice-info is-dismissible modal-kit-milestone" data-key="milestone"><p>%1$s <a href="%2$s" target="_blank" rel="noopener">%3$s</a></p></div>',
			esc_html__( 'Three modals live. Nice. Pro adds forms, multi-step flows and WooCommerce templates. This is the only time we’ll mention it here.', 'modal-kit' ),
			esc_url( self::PRO_URL ),
			esc_html__( 'See Pro', 'modal-kit' )
		);
	}
}

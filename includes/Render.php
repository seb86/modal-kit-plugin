<?php
/**
 * Prints modals on the front end.
 *
 * @package ModalKit
 */

namespace ModalKit;

use WP_Block;
use WP_HTML_Tag_Processor;
use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Decides which modals a request needs, enqueues their assets early and
 * prints each one once in wp_footer as a native <dialog>.
 */
final class Render {

	/**
	 * Script module ID of the Modal block's view script.
	 */
	const MODULE_ID = 'modal-kit-modal-view-script-module';

	/**
	 * Published modals, or null before they're loaded.
	 *
	 * @var WP_Post[]|null
	 */
	private $published = null;

	/**
	 * Rendered dialogs by post ID (or a key for virtual modals), built before
	 * the head is printed.
	 *
	 * @var array<int|string, string>
	 */
	private $rendered = array();

	/**
	 * Slugs of modals that the page's content links to.
	 *
	 * @var array<string, true>
	 */
	private $linked = array();

	/**
	 * Whether the shared assets are enqueued.
	 *
	 * @var bool
	 */
	private $enqueued = false;

	/**
	 * Whether this page prints modals (their assets are enqueued).
	 *
	 * @var bool
	 */
	private static $on_page = false;

	/**
	 * Whether this page prints modals. Known once the assets are enqueued:
	 * before the head in block themes, before the footer scripts in classic
	 * ones.
	 *
	 * @return bool
	 */
	public static function on_page() {
		return self::$on_page;
	}

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_filter( 'render_block', array( $this, 'collect_links' ), 10, 1 );
		// Before core prints block-support styles (wp_enqueue_scripts, 10), so
		// the layout and color styles of blocks inside modals reach the head.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ), 5 );
		add_action( 'wp_footer', array( $this, 'print_modals' ), 5 );
		add_filter(
			'show_admin_bar',
			static function ( $show ) {
				return Preview::is_request() ? false : $show;
			}
		);
	}

	/**
	 * Published modals.
	 *
	 * @return WP_Post[]
	 */
	public function published() {
		if ( null === $this->published ) {
			$this->published = get_posts(
				array(
					'post_type'        => PostType::NAME,
					'post_status'      => 'publish',
					'has_password'     => false,
					'posts_per_page'   => 100,
					'orderby'          => array(
						'menu_order' => 'ASC',
						'date'       => 'DESC',
					),
					'no_found_rows'    => true,
					'suppress_filters' => false,
				)
			);
		}

		return $this->published;
	}

	/**
	 * Notes links to modals in rendered blocks (#prefix-slug, ?modal=slug),
	 * so a linked modal is printed even where its targeting doesn't match.
	 *
	 * @param string $content Rendered block.
	 * @return string Unchanged content.
	 */
	public function collect_links( $content ) {
		if ( ! is_string( $content ) || false === strpos( $content, 'href' ) ) {
			return $content;
		}

		$prefix = preg_quote( self::link_prefix(), '/' );

		if ( preg_match_all( '/href=["\'][^"\']*(?:#' . $prefix . '|[?&](?:amp;|#038;)?modal=)([a-z0-9_-]+)/i', $content, $matches ) ) {
			foreach ( $matches[1] as $slug ) {
				$this->linked[ strtolower( $slug ) ] = true;
			}
		}

		return $content;
	}

	/**
	 * Renders the modals the request needs: those whose targeting matches,
	 * plus those the page links to. Runs before the head is printed, so their
	 * assets and block styles land there. Block themes render the template
	 * before the head, so their links are known by now.
	 *
	 * @return void
	 */
	public function enqueue() {
		$this->render_needed();
	}

	/**
	 * Prints the rendered modals. Classic themes render content after the
	 * head, so modals linked from it are rendered here, with late assets.
	 *
	 * @return void
	 */
	public function print_modals() {
		$this->render_needed();

		echo implode( "\n", $this->rendered ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Built from escaped parts and rendered blocks.
	}

	/**
	 * Renders every needed modal not rendered yet, and enqueues assets.
	 *
	 * @return void
	 */
	private function render_needed() {
		// The editor's homepage backdrop shows the page without any modal.
		if ( Backdrop::is_request() ) {
			return;
		}

		// The Display settings preview shows only its sample modal, open.
		if ( Preview::is_request() ) {
			if ( ! $this->rendered ) {
				$this->rendered[0] = self::dialog(
					Preview::post(),
					true,
					array(
						'triggers' => array(
							array(
								'type'  => 'load',
								'delay' => 0,
							),
						),
					)
				);
			}
			$this->enqueue_assets();
			return;
		}

		foreach ( $this->published() as $post ) {
			if ( isset( $this->rendered[ $post->ID ] ) || ! Meta::get( $post->ID, 'enabled' ) ) {
				continue;
			}

			$rules = Meta::get( $post->ID, 'rules' );

			// Hidden from this logged-in visitor ("Hide for logged-in users",
			// or an excluded role): not printed, so no trigger, link or
			// button can open it. ?modal=preview still shows it.
			if ( Rules::hidden_for_visitor( $rules ) && ! Rules::is_preview() ) {
				continue;
			}

			$targeted = Rules::targets_request( $rules );

			/**
			 * Filters whether a modal's page targeting matches this request.
			 *
			 * @param bool    $targeted Whether it matches.
			 * @param WP_Post $post     Modal.
			 */
			$targeted = (bool) apply_filters( 'modal_kit_targets_request', $targeted, $post );

			if ( ! $targeted && ! isset( $this->linked[ $post->post_name ] ) ) {
				continue;
			}

			$html = self::dialog( $post, $targeted );

			if ( '' !== $html ) {
				$this->rendered[ $post->ID ] = $html;
			}
		}

		// "Play in video lightbox" links share one lightbox.
		if ( VideoLinks::needed() && ! isset( $this->rendered[ VideoLinks::SLUG ] ) ) {
			$this->rendered[ VideoLinks::SLUG ] = self::dialog(
				VideoLinks::post(),
				true,
				array(
					'video'    => array_merge( Video::defaults(), array( 'autoplay' => true ) ),
					'lightbox' => true,
				)
			);
		}

		$this->enqueue_assets();
	}

	/**
	 * Enqueues the stylesheet, the script module and the store state once,
	 * when there is something to print.
	 *
	 * @return void
	 */
	private function enqueue_assets() {
		if ( $this->rendered && ! $this->enqueued ) {
			$this->enqueued = true;
			self::$on_page  = true;
			wp_enqueue_style( ThemeTokens::STYLE_HANDLE );
			wp_enqueue_script_module( self::MODULE_ID );
			wp_interactivity_state( 'modal-kit', self::state() );
		}
	}

	/**
	 * Store state shared by every modal on the page.
	 *
	 * @return array<string, mixed>
	 */
	public static function state() {
		$general = Settings::get( 'general' );

		return array(
			'prefix'        => self::link_prefix(),
			'linkHash'      => (bool) $general['linkHash'],
			'linkQuery'     => (bool) $general['linkQuery'],
			'debug'         => Settings::value( 'tools', 'debug' ) && current_user_can( 'manage_options' ),
			'preview'       => Rules::is_preview(),
			'remember'      => 'none' !== $general['remember'],
			'autoOpenLimit' => (int) $general['autoOpenLimit'],
			'cooldown'      => (int) $general['cooldown'],
			'breakpoint'    => (int) Settings::value( 'display', 'breakpoint' ),
			'i18n'          => array(
				'pause'      => __( 'Pause', 'modal-kit' ),
				'playVideo'  => __( 'Play video', 'modal-kit' ),
				'videoTitle' => __( 'Video', 'modal-kit' ),
				/* translators: %s: video service, e.g. YouTube. */
				'loadsFrom'  => __( 'Loads from %s, which may set cookies.', 'modal-kit' ),
				'resume'     => __( 'Resume', 'modal-kit' ),
				'copied'     => __( 'Copied ✓', 'modal-kit' ),
				'copyFailed' => __( 'Couldn’t copy. Select the text and copy it yourself.', 'modal-kit' ),
			),
		);
	}

	/**
	 * Builds the <dialog> markup for one modal.
	 *
	 * @param WP_Post              $post     Modal post.
	 * @param bool                 $targeted Whether the page targeting matches; automatic
	 *                                       triggers only run where it does.
	 * @param array<string, mixed> $context_overrides Context values to replace (preview).
	 * @return string Empty when the post has no Modal block.
	 */
	public static function dialog( WP_Post $post, $targeted = true, $context_overrides = array() ) {
		$parsed = self::find_modal_block( parse_blocks( $post->post_content ) );

		if ( null === $parsed ) {
			return '';
		}

		// The core filter render_block() would apply; add-ons read the Modal
		// block's attributes here (Pro: the product source).
		$parsed = (array) apply_filters( 'render_block_data', $parsed, $parsed, null ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core filter.

		$resolved = Layouts::resolve( $parsed['attrs'] );

		// The bundled fonts load only with a modal whose fixed style uses them.
		if ( Styles::needs_fonts( $resolved['style'] ) ) {
			wp_enqueue_style( Styles::FONTS_HANDLE );
		}

		$rules = Meta::get( $post->ID, 'rules' );
		$a11y  = Accessibility::for_modal( $post->ID );
		$panel = ( new WP_Block(
			$parsed,
			array(
				'postId'   => $post->ID,
				'postType' => $post->post_type,
			)
		) )->render();

		// Embed URLs become players through WP_Embed, which normally runs on
		// the_content; modals are rendered outside it.
		if ( isset( $GLOBALS['wp_embed'] ) && $GLOBALS['wp_embed'] instanceof \WP_Embed ) {
			$panel = $GLOBALS['wp_embed']->autoembed( $panel );
		}

		/**
		 * Filters a modal's rendered panel before the dialog is built, so
		 * add-ons can add markup (such as step progress).
		 *
		 * @param string               $panel    Panel markup.
		 * @param WP_Post              $post     Modal.
		 * @param array<string, mixed> $resolved Resolved layout attributes.
		 * @param array<string, mixed> $attrs    Modal block attributes.
		 */
		$panel = (string) apply_filters( 'modal_kit_dialog_panel', $panel, $post, $resolved, $parsed['attrs'] );

		$dom_id   = self::dom_id( $post );
		$labelled = self::label_heading( $panel, $dom_id );
		$panel    = $labelled['html'];
		$video    = null;

		// Video and Embed blocks: privacy, deferred loading, player APIs.
		if ( Video::has_video( $panel ) || 'video' === $resolved['layout'] ) {
			$video = Video::settings( $post->ID );
			$panel = Video::prepare( $panel, $video );
		}
		$context = array(
			'id'         => $post->ID,
			'slug'       => $post->post_name,
			'layout'     => $resolved['layout'],
			// Overlay layouts make the page behind inert unless that's turned off.
			'modal'      => $resolved['modal'] && $a11y['inert'],
			'esc'        => $resolved['closeOptions']['esc'],
			'outside'    => $resolved['closeOptions']['outside'],
			'lockScroll' => $resolved['modal'] && $a11y['lockScroll'],
			'focus'      => $a11y['focus'],
			'autoClose'  => $a11y['autoClose'],
			'triggers'   => Meta::get( $post->ID, 'triggers' ),
			'targeted'   => (bool) $targeted,
			'rules'      => Rules::for_browser( $rules ),
			'hidden'     => Rules::hidden_for_visitor( $rules ),
			// Editing the modal resets its "already seen" state.
			'version'    => substr( md5( $post->post_content . wp_json_encode( $rules ) ), 0, 8 ),
			'video'      => $video,
		);
		$context = array_merge( $context, $context_overrides );

		/**
		 * Filters the runtime context of a modal: triggers, rules, closing
		 * and focus, as the browser receives them. Add-ons use it for layouts
		 * that open themselves (Pro: the age gate).
		 *
		 * @param array<string, mixed> $context  Context.
		 * @param WP_Post              $post     Modal.
		 * @param array<string, mixed> $resolved Resolved layout.
		 */
		$context = (array) apply_filters( 'modal_kit_dialog_context', $context, $post, $resolved );

		$classes = Layouts::container_classes( $resolved );

		if ( 'none' === $a11y['reducedMotion'] ) {
			$classes[] = 'modal-kit--rm-none';
		}

		$attributes = array(
			'id'                  => $dom_id,
			'class'               => implode( ' ', $classes ),
			'style'               => trim( Layouts::container_style( $resolved ) . ( $video ? ';--modal-kit-video-ratio:' . Video::css_ratio( $video['aspectRatio'] ) : '' ), ';' ),
			'data-wp-interactive' => 'modal-kit',
			'data-wp-context'     => (string) wp_json_encode( $context ),
			'data-wp-init'        => 'callbacks.init',
			'data-wp-on--cancel'  => 'actions.onCancel',
			'data-wp-on--click'   => 'actions.onClick',
		);

		// Accessible name: the first heading by default, or the title or
		// a custom name.
		if ( 'custom' === $a11y['name'] && '' !== $a11y['customName'] ) {
			$attributes['aria-label'] = $a11y['customName'];
		} elseif ( 'heading' === $a11y['name'] && $labelled['id'] ) {
			$attributes['aria-labelledby'] = $labelled['id'];
		} else {
			$attributes['aria-label'] = get_the_title( $post );
		}

		$html = '<dialog';
		foreach ( $attributes as $name => $value ) {
			if ( '' === $value ) {
				continue;
			}
			$html .= ' ' . $name . '="' . esc_attr( $value ) . '"';
		}
		$html .= '>' . $panel . '</dialog>';

		return function_exists( 'wp_interactivity_process_directives' ) ? wp_interactivity_process_directives( $html ) : $html;
	}

	/**
	 * The dialog's HTML id, which is also the link fragment (#modal-slug).
	 *
	 * @param WP_Post $post Modal post.
	 * @return string
	 */
	public static function dom_id( WP_Post $post ) {
		return sanitize_html_class( self::link_prefix() . $post->post_name );
	}

	/**
	 * Prefix of modal link anchors (Settings → General, "Link prefix").
	 *
	 * @return string
	 */
	public static function link_prefix() {
		/**
		 * Filters the prefix of modal link anchors.
		 *
		 * @param string $prefix From Settings → General (default "modal-").
		 */
		return sanitize_html_class( (string) apply_filters( 'modal_kit_link_prefix', (string) Settings::value( 'general', 'linkPrefix' ) ) );
	}

	/**
	 * Label for the close button (Settings → Accessibility, or the modal's
	 * own override).
	 *
	 * @param int $post_id Modal ID.
	 * @return string
	 */
	public static function close_label( $post_id = 0 ) {
		/**
		 * Filters the close button label.
		 *
		 * @param string $label   Label.
		 * @param int    $post_id Modal ID.
		 */
		return (string) apply_filters( 'modal_kit_close_label', Accessibility::for_modal( $post_id )['closeLabel'], $post_id );
	}

	/**
	 * Gives the first heading an id so it can name the dialog.
	 *
	 * @param string $html   Panel markup.
	 * @param string $dom_id Dialog id, used to build the heading id.
	 * @return array{html: string, id: string}
	 */
	public static function label_heading( $html, $dom_id ) {
		$processor = new WP_HTML_Tag_Processor( $html );

		while ( $processor->next_tag() ) {
			if ( ! in_array( $processor->get_tag(), array( 'H1', 'H2', 'H3', 'H4', 'H5', 'H6' ), true ) ) {
				continue;
			}

			$id = $processor->get_attribute( 'id' );

			if ( ! is_string( $id ) || '' === $id ) {
				$id = $dom_id . '-title';
				$processor->set_attribute( 'id', $id );
			}

			return array(
				'html' => $processor->get_updated_html(),
				'id'   => $id,
			);
		}

		return array(
			'html' => $html,
			'id'   => '',
		);
	}

	/**
	 * Finds the first Modal block in a parsed block tree.
	 *
	 * @param array<int, array<string, mixed>> $blocks Parsed blocks.
	 * @return array<string, mixed>|null
	 */
	public static function find_modal_block( $blocks ) {
		foreach ( $blocks as $block ) {
			if ( 'modal-kit/modal' === $block['blockName'] ) {
				return $block;
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				$found = self::find_modal_block( $block['innerBlocks'] );

				if ( null !== $found ) {
					return $found;
				}
			}
		}

		return null;
	}
}

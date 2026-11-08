/**
 * Video in modals (mockups 6a–6c). Imported only when a modal with video
 * opens. Players load on open (or behind the click-to-load screen), always
 * pause on close, and can autoplay muted, resume, or close when they end.
 * YouTube and Vimeo are controlled through their postMessage player APIs.
 */
import { isWebUrl } from './safe-url';
import { closeModal } from './modals';

const reducedMotion = () =>
	window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

/**
 * Sends a command to a YouTube or Vimeo player.
 *
 * @param {HTMLIFrameElement} iframe  Player.
 * @param {string}            command pause | play | mute | restart | listen.
 */
function send( iframe, command ) {
	const target = iframe.contentWindow;
	const provider = iframe.dataset.modalKitProvider;

	if ( ! target || ! iframe.getAttribute( 'src' ) ) {
		return;
	}

	if ( provider === 'youtube' ) {
		const calls = {
			pause: [ 'pauseVideo' ],
			play: [ 'playVideo' ],
			mute: [ 'mute' ],
			restart: [ 'seekTo', [ 0, true ] ],
		};

		if ( command === 'listen' ) {
			target.postMessage(
				JSON.stringify( {
					event: 'listening',
					id: 1,
					channel: 'widget',
				} ),
				'*'
			);
			return;
		}

		const [ func, args = [] ] = calls[ command ];
		target.postMessage(
			JSON.stringify( { event: 'command', func, args } ),
			'*'
		);
	}

	if ( provider === 'vimeo' ) {
		const methods = {
			pause: { method: 'pause' },
			play: { method: 'play' },
			mute: { method: 'setVolume', value: 0 },
			restart: { method: 'setCurrentTime', value: 0 },
			listen: { method: 'addEventListener', value: 'ended' },
		};

		target.postMessage( JSON.stringify( methods[ command ] ), '*' );
	}
}

/**
 * The player URL with autoplay (muted) added.
 *
 * @param {string}  src      Player URL.
 * @param {string}  provider youtube | vimeo.
 * @param {boolean} muted    Mute it (autoplay without a click must be muted).
 * @return {string} URL.
 */
function withAutoplay( src, provider, muted ) {
	const url = new URL( src, window.location.href );

	url.searchParams.set( 'autoplay', '1' );

	if ( muted ) {
		url.searchParams.set( provider === 'vimeo' ? 'muted' : 'mute', '1' );
	}

	return url.toString();
}

/**
 * Loads a deferred iframe.
 *
 * @param {HTMLIFrameElement} iframe           Player.
 * @param {Object}            options          Options.
 * @param {boolean}           options.autoplay Start playing.
 * @param {boolean}           options.muted    Mute (autoplay without a click).
 */
function loadIframe( iframe, { autoplay, muted } ) {
	const src = iframe.dataset.modalKitSrc;

	if ( ! isWebUrl( src ) || iframe.getAttribute( 'src' ) ) {
		return;
	}

	iframe.addEventListener( 'load', () => send( iframe, 'listen' ), {
		once: true,
	} );
	iframe.src = autoplay
		? withAutoplay( src, iframe.dataset.modalKitProvider, muted )
		: src;
}

/**
 * Sets up the players of a modal that just opened.
 *
 * @param {Object} entry Registry entry ({ dialog, config }).
 */
export function onOpen( entry ) {
	const { dialog, config } = entry;
	const settings = config.video ?? {};
	const autoplay = settings.autoplay && ! reducedMotion();

	dialog
		.querySelectorAll( 'iframe[data-modal-kit-provider]' )
		.forEach( ( iframe ) => {
			const waiting =
				iframe.parentElement?.querySelector( '.modal-kit-consent' );

			if ( ! iframe.getAttribute( 'src' ) ) {
				if ( ! waiting && settings.load === 'open' ) {
					loadIframe( iframe, { autoplay, muted: true } );
				}
				return;
			}

			if ( ! settings.resume ) {
				send( iframe, 'restart' );
			}

			if ( autoplay ) {
				send( iframe, 'mute' );
				send( iframe, 'play' );
			}
		} );

	dialog.querySelectorAll( 'video' ).forEach( ( video ) => {
		if ( ! settings.resume ) {
			video.currentTime = 0;
		}

		if ( autoplay ) {
			video.muted = true;
			video.play().catch( () => {} );
		}
	} );

	if ( ! entry.videoEndBound ) {
		entry.videoEndBound = true;
		bindEnded( entry );
		bindCommands( entry );
	}
}

/**
 * Lets add-ons control the players: `modal-kit:video-command` on the dialog
 * with detail { command: 'play' | 'pause' | 'restart' }.
 *
 * @param {Object} entry Registry entry.
 */
function bindCommands( entry ) {
	entry.dialog.addEventListener( 'modal-kit:video-command', ( event ) => {
		const command = event.detail?.command;

		entry.dialog
			.querySelectorAll( 'iframe[data-modal-kit-provider]' )
			.forEach( ( iframe ) => {
				if ( command === 'restart' ) {
					send( iframe, 'restart' );
					send( iframe, 'play' );
				} else if ( command === 'play' || command === 'pause' ) {
					send( iframe, command );
				}
			} );

		entry.dialog.querySelectorAll( 'video' ).forEach( ( video ) => {
			if ( command === 'restart' ) {
				video.currentTime = 0;
			}
			if ( command === 'pause' ) {
				video.pause();
			} else if ( command ) {
				video.play().catch( () => {} );
			}
		} );
	} );
}

/**
 * When a video ends: tells add-ons (`modal-kit:video-ended`, e.g. Pro's end
 * screen) and closes the modal if "Close when the video ends" is on.
 *
 * @param {Object} entry Registry entry.
 */
function bindEnded( entry ) {
	const { dialog } = entry;
	const ended = () => {
		dialog.dispatchEvent(
			new window.CustomEvent( 'modal-kit:video-ended', { bubbles: true } )
		);

		if ( entry.config.video?.closeOnEnd ) {
			closeModal( dialog, 'ended' );
		}
	};

	dialog
		.querySelectorAll( 'video' )
		.forEach( ( video ) => video.addEventListener( 'ended', ended ) );

	window.addEventListener( 'message', ( event ) => {
		const iframe = [ ...dialog.querySelectorAll( 'iframe' ) ].find(
			( frame ) => frame.contentWindow === event.source
		);

		if ( ! iframe || ! dialog.open ) {
			return;
		}

		let data = event.data;
		try {
			data = typeof data === 'string' ? JSON.parse( data ) : data;
		} catch {
			return;
		}

		const hasEnded =
			data?.event === 'ended' || // Vimeo.
			( data?.event === 'onStateChange' && data.info === 0 ) || // YouTube.
			( data?.event === 'infoDelivery' && data.info?.playerState === 0 );

		if ( hasEnded ) {
			ended();
		}
	} );
}

/**
 * Pauses every player in a modal that is closing.
 *
 * @param {Object} entry Registry entry.
 */
export function onClose( entry ) {
	entry.dialog
		.querySelectorAll( 'iframe[data-modal-kit-provider]' )
		.forEach( ( iframe ) => send( iframe, 'pause' ) );
	entry.dialog
		.querySelectorAll( 'video' )
		.forEach( ( video ) => video.pause() );

	// The shared lightbox starts empty each time.
	if ( entry.config.lightbox ) {
		const wrapper = entry.dialog.querySelector(
			'.modal-kit-video-slot .wp-block-embed__wrapper'
		);

		if ( wrapper ) {
			wrapper.replaceChildren();
		}
	}
}

/**
 * The click-to-load screen's "Play video" button.
 *
 * @param {HTMLElement} button Button.
 */
export function loadFromConsent( button ) {
	const wrapper = button.closest( '.modal-kit-consent' )?.parentElement;
	const iframe = wrapper?.querySelector( 'iframe[data-modal-kit-src]' );

	if ( ! iframe ) {
		return;
	}

	// The visitor asked to play: autoplay with sound.
	loadIframe( iframe, { autoplay: true, muted: false } );
	button.closest( '.modal-kit-consent' ).remove();
	iframe.focus();
}

/**
 * A player for a URL (6b): YouTube, Vimeo or a video file.
 *
 * @param {string} url URL.
 * @return {Object|null} { provider, src } or null.
 */
export function playerFor( url ) {
	if ( ! isWebUrl( url ) ) {
		return null;
	}

	let parsed;

	try {
		parsed = new URL( url, window.location.href );
	} catch {
		return null;
	}

	const host = parsed.hostname.replace( /^www\./, '' );
	let id = null;

	if ( host === 'youtu.be' ) {
		id = parsed.pathname.slice( 1 );
	} else if ( /(^|\.)youtube(-nocookie)?\.com$/.test( host ) ) {
		id =
			parsed.searchParams.get( 'v' ) ??
			parsed.pathname.match( /\/(?:embed|shorts|live)\/([\w-]+)/ )?.[ 1 ];
	}

	if ( id ) {
		const start =
			parseInt( parsed.searchParams.get( 't' ) ?? '0', 10 ) || 0;
		return {
			provider: 'youtube',
			src: `https://www.youtube-nocookie.com/embed/${ encodeURIComponent( id ) }?enablejsapi=1&playsinline=1&rel=0${ start ? `&start=${ start }` : '' }`,
		};
	}

	const vimeo =
		/(^|\.)vimeo\.com$/.test( host ) &&
		parsed.pathname.match( /\/(\d+)/ )?.[ 1 ];
	if ( vimeo ) {
		return {
			provider: 'vimeo',
			src: `https://player.vimeo.com/video/${ vimeo }?dnt=1`,
		};
	}

	if ( /\.(mp4|webm|ogv|mov)$/i.test( parsed.pathname ) ) {
		return { provider: 'file', src: parsed.toString() };
	}

	return null;
}

/**
 * Fills the shared lightbox with a player for a link (6b).
 *
 * @param {HTMLDialogElement} dialog      The shared lightbox.
 * @param {string}            url         Video URL.
 * @param {boolean}           clickToLoad Show the click-to-load screen.
 * @param {Object}            i18n        Translated strings.
 * @return {boolean} Whether a player was created.
 */
export function fillLightbox( dialog, url, clickToLoad, i18n ) {
	const wrapper = dialog.querySelector(
		'.modal-kit-video-slot .wp-block-embed__wrapper'
	);
	const player = playerFor( url );

	if ( ! wrapper || ! player ) {
		return false;
	}

	wrapper.replaceChildren();

	if ( player.provider === 'file' ) {
		const video = document.createElement( 'video' );
		video.src = player.src;
		video.controls = true;
		video.playsInline = true;
		video.autoplay = ! reducedMotion();
		wrapper.append( video );
		return true;
	}

	const iframe = document.createElement( 'iframe' );
	iframe.dataset.modalKitProvider = player.provider;
	iframe.dataset.modalKitSrc = player.src;
	iframe.title = i18n.videoTitle ?? 'Video';
	iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
	iframe.allowFullscreen = true;
	wrapper.append( iframe );

	if ( clickToLoad ) {
		const consent = document.createElement( 'div' );
		const button = document.createElement( 'button' );
		const note = document.createElement( 'p' );
		const name = player.provider === 'vimeo' ? 'Vimeo' : 'YouTube';

		consent.className = 'modal-kit-consent';
		button.type = 'button';
		button.className = 'modal-kit-consent__play';
		button.textContent = `▶ ${ i18n.playVideo ?? 'Play video' }`;
		button.addEventListener( 'click', () => loadFromConsent( button ) );
		note.className = 'modal-kit-consent__note';
		note.textContent = (
			i18n.loadsFrom ?? 'Loads from %s, which may set cookies.'
		).replace( '%s', name );
		consent.append( button, note );
		wrapper.append( consent );
	} else {
		loadIframe( iframe, { autoplay: ! reducedMotion(), muted: false } );
	}

	return true;
}

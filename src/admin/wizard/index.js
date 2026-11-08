/**
 * First-run setup wizard (mockups 7a–7d). Four steps that pre-fill the
 * General, Display and Accessibility settings, then create the first modal
 * as a draft and open it in the editor.
 */
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	CheckboxControl,
	ExternalLink,
	Notice,
	SelectControl,
	ToggleControl,
} from '@wordpress/components';
import domReady from '@wordpress/dom-ready';
import {
	createInterpolateElement,
	createRoot,
	useEffect,
	useState,
} from '@wordpress/element';
import { addQueryArgs } from '@wordpress/url';

import { fixedStyles } from '../../styles';
import './style.scss';

const data = window.modalKitWizard ?? {};

const STEPS = [
	__( 'Welcome', 'modal-kit' ),
	__( 'Look', 'modal-kit' ),
	__( 'Behaviour', 'modal-kit' ),
	__( 'First modal', 'modal-kit' ),
];

const USE_CASES = [
	{
		key: 'newsletter',
		short: __( 'Newsletter', 'modal-kit' ),
		kind: __( 'Newsletter', 'modal-kit' ),
		label: __( 'Newsletter signups', 'modal-kit' ),
		description: __(
			'Grow your list with a well-timed invite.',
			'modal-kit'
		),
		category: 'modal-kit-newsletter',
	},
	{
		key: 'promotions',
		short: __( 'Promotions', 'modal-kit' ),
		kind: __( 'Promotion', 'modal-kit' ),
		label: __( 'Promotions & discounts', 'modal-kit' ),
		description: __( 'Sales, codes and limited-time offers.', 'modal-kit' ),
		category: 'modal-kit-promo',
	},
	{
		key: 'announcements',
		short: __( 'Announcements', 'modal-kit' ),
		kind: __( 'Announcement', 'modal-kit' ),
		label: __( 'Announcements', 'modal-kit' ),
		description: __( 'News, events, opening hours.', 'modal-kit' ),
		category: 'modal-kit-announcement',
	},
	{
		key: 'exit',
		short: __( 'Exit offers', 'modal-kit' ),
		kind: __( 'Exit', 'modal-kit' ),
		label: __( 'Exit offers', 'modal-kit' ),
		description: __( 'A last word before someone leaves.', 'modal-kit' ),
		category: 'modal-kit-exit',
	},
	{
		key: 'video',
		short: __( 'Video', 'modal-kit' ),
		kind: __( 'Video', 'modal-kit' ),
		label: __( 'Video', 'modal-kit' ),
		description: __(
			'Play tours and product clips in a lightbox.',
			'modal-kit'
		),
		category: 'modal-kit-video',
	},
	...( data.woocommerce
		? [
				{
					key: 'woocommerce',
					short: __( 'WooCommerce', 'modal-kit' ),
					kind: __( 'WooCommerce', 'modal-kit' ),
					label: __( 'WooCommerce', 'modal-kit' ),
					description: __(
						'Quick view, cart drawer and cart offers.',
						'modal-kit'
					),
					detected: __( 'WooCommerce detected.', 'modal-kit' ),
					category: 'woocommerce',
				},
			]
		: [] ),
];

// Every look shows the same sample, so they compare like for like.
const SAMPLE = [
	__( 'Autumn sale', 'modal-kit' ),
	__( '20% off every notebook.', 'modal-kit' ),
	__( 'Get the code', 'modal-kit' ),
];

// The looks that follow the theme, drawn in its colors (COLORS, below).
const STYLES = [
	{
		key: 'default',
		label: __( 'Native', 'modal-kit' ),
		description: __( 'Flat, your theme’s radius and colors.', 'modal-kit' ),
	},
	{
		key: 'soft',
		label: __( 'Soft', 'modal-kit' ),
		description: __( 'Rounded, layered, room for imagery.', 'modal-kit' ),
	},
	{
		key: 'editorial',
		label: __( 'Editorial', 'modal-kit' ),
		description: __( 'Bold type, high contrast, full-bleed.', 'modal-kit' ),
		inverted: true,
	},
];

// The Modal Kit styles bring their own colors and fonts (Style Palette).
const FIXED_DESCRIPTIONS = {
	fieldnote: __( 'The Modal Kit palette. Clean, violet, sans.', 'modal-kit' ),
	harbor: __( 'Paper, serif headings, square corners.', 'modal-kit' ),
	night: __( 'Dark panel, amber accent, pill buttons.', 'modal-kit' ),
};

/**
 * Every style the wizard offers, with the colors its sample uses: the three
 * that follow the theme, then the fixed ones.
 *
 * @return {Object[]} Styles.
 */
function allStyles() {
	return [
		...STYLES.map( ( style ) => ( {
			...style,
			tokens: style.inverted
				? {
						'--mk-surface': COLORS.contrast,
						'--mk-ink': COLORS.base,
						'--mk-accent': COLORS.base,
						'--mk-on-accent': COLORS.contrast,
					}
				: {
						'--mk-surface': COLORS.base,
						'--mk-ink': COLORS.contrast,
						'--mk-accent': COLORS.button,
						'--mk-on-accent': COLORS.buttonText,
					},
		} ) ),
		...Object.entries( fixedStyles() ).map( ( [ key, style ] ) => ( {
			key,
			label: style.label,
			description:
				FIXED_DESCRIPTIONS[ key ] ??
				__( 'Brings its own colors and fonts.', 'modal-kit' ),
			fixed: true,
			tokens: {
				'--mk-surface': style.surface,
				'--mk-ink': style.ink,
				'--mk-accent': style.accent,
				'--mk-on-accent': style.onAccent,
			},
		} ) ),
	];
}

const LAYOUT_LABELS = {
	centered: __( 'Centered', 'modal-kit' ),
	split: __( 'Split', 'modal-kit' ),
	bar: __( 'Bar', 'modal-kit' ),
	full: __( 'Full-screen', 'modal-kit' ),
	corner: __( 'Corner', 'modal-kit' ),
	drawer: __( 'Drawer', 'modal-kit' ),
	sheet: __( 'Sheet', 'modal-kit' ),
	inline: __( 'Inline', 'modal-kit' ),
};

/**
 * The modal layout used by a pattern, read from its block comment.
 *
 * @param {string} content Pattern content.
 * @return {string} Layout.
 */
function layoutOf( content ) {
	const match = /<!-- wp:modal-kit\/modal (\{.*?\}) -->/.exec(
		content ?? ''
	);

	try {
		return JSON.parse( match?.[ 1 ] ?? '{}' ).modalLayout ?? 'centered';
	} catch {
		return 'centered';
	}
}

const COLORS = {
	base: '#ffffff',
	contrast: '#1e1e1e',
	button: '#1e1e1e',
	buttonText: '#ffffff',
	...data.colors,
};

/**
 * Text for a starter's preview: its first heading and button.
 *
 * @param {string} content Pattern content.
 * @return {{heading: string, button: string}} Text.
 */
function textOf( content ) {
	const doc = new window.DOMParser().parseFromString(
		content ?? '',
		'text/html'
	);
	const text = ( selector ) =>
		doc.querySelector( selector )?.textContent.trim() ?? '';

	return {
		heading: text( 'h1, h2, h3, h4' ) || text( 'p' ),
		button: text( '.wp-block-button__link' ),
	};
}

/**
 * A miniature of a starter (7d): its layout, heading and button on a striped
 * page, in the theme's colors and the look picked in step 2.
 *
 * @param {Object} props
 * @param {string} props.layout  Modal layout.
 * @param {string} props.heading Heading text.
 * @param {string} props.button  Button text.
 * @param {string} props.look    default | soft | editorial.
 */
function StarterPreview( { layout, heading, button, look } ) {
	const surface =
		look === 'editorial'
			? { background: COLORS.contrast, color: COLORS.base }
			: { background: COLORS.base, color: COLORS.contrast };
	const action = button && (
		<span
			className="modal-kit-wizard__mini-button"
			style={ {
				background: COLORS.button,
				color: COLORS.buttonText,
			} }
		>
			{ button }
		</span>
	);

	if ( layout === 'bar' ) {
		return (
			<span
				className="modal-kit-wizard__mini is-bar"
				style={ {
					background: COLORS.button,
					color: COLORS.buttonText,
				} }
			>
				{ heading }
			</span>
		);
	}

	if ( layout === 'full' ) {
		return (
			<span
				className="modal-kit-wizard__mini is-full"
				style={ { background: COLORS.contrast, color: COLORS.base } }
			>
				<span className="modal-kit-wizard__mini-heading">
					{ heading }
				</span>
				{ button && (
					<span
						className="modal-kit-wizard__mini-button"
						style={ {
							background: COLORS.base,
							color: COLORS.contrast,
						} }
					>
						{ button }
					</span>
				) }
			</span>
		);
	}

	return (
		<span
			className={ `modal-kit-wizard__mini is-${ layout } is-look-${ look }` }
			style={ surface }
		>
			{ layout === 'split' && (
				<span
					className="modal-kit-wizard__mini-media"
					style={ { background: COLORS.button } }
				/>
			) }
			<span className="modal-kit-wizard__mini-content">
				<span className="modal-kit-wizard__mini-heading">
					{ heading }
				</span>
				{ action }
			</span>
		</span>
	);
}

function stepClass( index, step ) {
	if ( index < step ) {
		return 'is-done';
	}

	return index === step ? 'is-current' : '';
}

function Stepper( { step } ) {
	return (
		<ol className="modal-kit-wizard__steps">
			{ STEPS.map( ( label, index ) => (
				<li
					key={ label }
					className={ stepClass( index, step ) }
					aria-current={ index === step ? 'step' : undefined }
				>
					{ index > 0 && (
						<span
							className="modal-kit-wizard__step-line"
							aria-hidden="true"
						/>
					) }
					<span
						className="modal-kit-wizard__step-number"
						aria-hidden="true"
					>
						{ index < step ? '✓' : index + 1 }
					</span>
					{ label }
				</li>
			) ) }
		</ol>
	);
}

function Welcome( { useCases, setUseCases } ) {
	const toggle = ( key, on ) =>
		setUseCases(
			on ? [ ...useCases, key ] : useCases.filter( ( k ) => k !== key )
		);

	return (
		<>
			<h1>{ __( 'Let’s set up Modal Kit', 'modal-kit' ) }</h1>
			<p className="modal-kit-wizard__lead">
				{ __(
					'Two minutes and four quick steps. Everything here can be changed later in Settings.',
					'modal-kit'
				) }
			</p>
			<div className="modal-kit-wizard__theme">
				<div>
					<strong>
						{ sprintf(
							/* translators: %s: theme name. */
							__( 'We’ll use your theme: %s', 'modal-kit' ),
							data.theme?.name
						) }
					</strong>
					<p>
						{ __(
							'Modals pick up its colors, fonts and spacing. The editor shows exactly what visitors see.',
							'modal-kit'
						) }
					</p>
				</div>
				{ data.theme?.block && (
					<span className="modal-kit-wizard__badge">
						{ __( 'Block theme', 'modal-kit' ) }
					</span>
				) }
			</div>
			<fieldset>
				<legend>
					{ __( 'What will you use modals for?', 'modal-kit' ) }
				</legend>
				<div className="modal-kit-wizard__choices">
					{ USE_CASES.map( ( useCase ) => (
						<CheckboxControl
							key={ useCase.key }
							__nextHasNoMarginBottom
							className={ `modal-kit-wizard__choice${
								useCases.includes( useCase.key )
									? ' is-checked'
									: ''
							}` }
							label={ useCase.label }
							help={
								<>
									{ useCase.description }
									{ useCase.detected && (
										<>
											{ ' ' }
											<span className="modal-kit-wizard__detected">
												{ useCase.detected }
											</span>
										</>
									) }
								</>
							}
							checked={ useCases.includes( useCase.key ) }
							onChange={ ( on ) => toggle( useCase.key, on ) }
						/>
					) ) }
				</div>
			</fieldset>
		</>
	);
}

function Look( { style, setStyle, mobile, setMobile } ) {
	return (
		<>
			<h1>{ __( 'Pick a starting look', 'modal-kit' ) }</h1>
			<p className="modal-kit-wizard__lead">
				{ __(
					'Applied to new modals and starter templates. Each modal can still be styled with normal block controls.',
					'modal-kit'
				) }
			</p>
			<div
				className="modal-kit-wizard__styles"
				role="radiogroup"
				aria-label={ __( 'Style', 'modal-kit' ) }
			>
				{ allStyles().map( ( item ) => (
					<button
						type="button"
						key={ item.key }
						role="radio"
						aria-checked={ style === item.key }
						className={ `modal-kit-wizard__style is-${ item.key }${
							item.fixed ? ' is-fixed' : ''
						}` }
						onClick={ () => setStyle( item.key ) }
					>
						<span
							className={ `modal-kit-wizard__sample${
								item.fixed
									? ` mk-style mk-style-${ item.key }`
									: ''
							}` }
							style={ item.tokens }
							aria-hidden="true"
						>
							<span className="modal-kit-wizard__sample-eyebrow">
								{ SAMPLE[ 0 ] }
							</span>
							<span className="modal-kit-wizard__sample-heading">
								{ SAMPLE[ 1 ] }
							</span>
							<span className="modal-kit-wizard__sample-button">
								{ SAMPLE[ 2 ] }
							</span>
						</span>
						<strong>{ item.label }</strong>
						<span>{ item.description }</span>
					</button>
				) ) }
			</div>
			<div className="modal-kit-wizard__row">
				<div>
					<strong>{ __( 'On phones', 'modal-kit' ) }</strong>
					<p>
						{ __(
							'Dialogs and split layouts can become bottom sheets below 600px.',
							'modal-kit'
						) }
					</p>
				</div>
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'On phones', 'modal-kit' ) }
					hideLabelFromVision
					value={ mobile }
					options={ [
						{
							value: 'sheet',
							label: __( 'Use bottom sheets', 'modal-kit' ),
						},
						{
							value: 'auto',
							label: __(
								'Keep dialogs, sheets for split',
								'modal-kit'
							),
						},
						{
							value: 'same',
							label: __( 'Same as desktop', 'modal-kit' ),
						},
					] }
					onChange={ setMobile }
				/>
			</div>
		</>
	);
}

function Behaviour( { behaviour, setBehaviour } ) {
	const set = ( changes ) => setBehaviour( { ...behaviour, ...changes } );

	return (
		<>
			<h1>{ __( 'How polite should modals be?', 'modal-kit' ) }</h1>
			<p className="modal-kit-wizard__lead">
				{ __(
					'Good defaults keep visitors happy. Click-to-open modals are never limited.',
					'modal-kit'
				) }
			</p>
			<div className="modal-kit-wizard__panel">
				<div className="modal-kit-wizard__setting">
					<div>
						<strong>
							{ __(
								'Auto-opening modals per page',
								'modal-kit'
							) }
						</strong>
						<p>
							{ __(
								'Stops two offers fighting for attention.',
								'modal-kit'
							) }
						</p>
					</div>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __(
							'Auto-opening modals per page',
							'modal-kit'
						) }
						hideLabelFromVision
						value={ String( behaviour.autoOpenLimit ) }
						options={ [
							{
								value: '1',
								label: __( 'At most 1', 'modal-kit' ),
							},
							{
								value: '2',
								label: __( 'At most 2', 'modal-kit' ),
							},
							{
								value: '3',
								label: __( 'At most 3', 'modal-kit' ),
							},
							{
								value: '0',
								label: __( 'No limit', 'modal-kit' ),
							},
						] }
						onChange={ ( value ) =>
							set( { autoOpenLimit: parseInt( value, 10 ) } )
						}
					/>
				</div>
				<div className="modal-kit-wizard__setting">
					<div>
						<strong>
							{ __(
								'After someone closes a modal',
								'modal-kit'
							) }
						</strong>
						<p>
							{ __(
								'Remembered in their browser. No cookies, nothing personal.',
								'modal-kit'
							) }
						</p>
					</div>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __(
							'After someone closes a modal',
							'modal-kit'
						) }
						hideLabelFromVision
						value={ String( behaviour.waitDays ) }
						options={ [
							{
								value: '1',
								label: __( 'Wait 1 day', 'modal-kit' ),
							},
							{
								value: '7',
								label: __( 'Wait 7 days', 'modal-kit' ),
							},
							{
								value: '30',
								label: __( 'Wait 30 days', 'modal-kit' ),
							},
						] }
						onChange={ ( value ) =>
							set( { waitDays: parseInt( value, 10 ) } )
						}
					/>
				</div>
				<ToggleControl
					__nextHasNoMarginBottom
					className="modal-kit-wizard__switch"
					label={ __(
						'Don’t show modals to administrators',
						'modal-kit'
					) }
					help={ createInterpolateElement(
						__(
							'You’ll still see them in previews and when you add <code>?modal=preview</code>.',
							'modal-kit'
						),
						{ code: <code /> }
					) }
					checked={ behaviour.hideAdmins }
					onChange={ ( hideAdmins ) => set( { hideAdmins } ) }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					className="modal-kit-wizard__switch"
					label={ __(
						'Use a simple fade for visitors who prefer reduced motion',
						'modal-kit'
					) }
					help={ __(
						'Recommended. You can change this later in Settings → Accessibility.',
						'modal-kit'
					) }
					checked={ behaviour.fade }
					onChange={ ( fade ) => set( { fade } ) }
				/>
			</div>
		</>
	);
}

function FirstModal( { useCases, selected, setSelected, look } ) {
	const [ patterns, setPatterns ] = useState( null );
	const [ filter, setFilter ] = useState( 'for-you' );

	useEffect( () => {
		apiFetch( { path: '/wp/v2/block-patterns/patterns' } )
			.then( ( all ) =>
				setPatterns(
					all.filter( ( p ) => p.name.startsWith( 'modal-kit/' ) )
				)
			)
			.catch( () => setPatterns( [] ) );
	}, [] );

	const chosen = USE_CASES.filter( ( item ) =>
		useCases.includes( item.key )
	);
	const categories = chosen.map( ( item ) => item.category );
	const kindOf = ( pattern ) =>
		USE_CASES.find( ( item ) =>
			pattern.categories.includes( item.category )
		)?.kind;
	const proDrawer =
		useCases.includes( 'woocommerce' ) &&
		data.showProTips &&
		[ 'for-you', 'woocommerce' ].includes( filter );
	const visible = ( patterns ?? [] ).filter( ( pattern ) =>
		filter === 'for-you'
			? ! categories.length ||
				pattern.categories.some( ( c ) => categories.includes( c ) )
			: pattern.categories.includes( filter )
	);

	return (
		<>
			<h1>{ __( 'Create your first modal', 'modal-kit' ) }</h1>
			<p className="modal-kit-wizard__lead">
				{ __(
					'Picked for what you told us. It opens in the editor as a draft, so nothing goes live yet.',
					'modal-kit'
				) }
			</p>
			<div
				className="modal-kit-wizard__filters"
				role="group"
				aria-label={ __( 'Filter starters', 'modal-kit' ) }
			>
				{ [
					{
						key: 'for-you',
						label: __( 'For you', 'modal-kit' ),
						category: 'for-you',
					},
					...chosen,
				]
					.filter(
						( item ) =>
							item.category === 'for-you' ||
							( item.category === 'woocommerce'
								? data.showProTips
								: ( patterns ?? [] ).some( ( pattern ) =>
										pattern.categories.includes(
											item.category
										)
									) )
					)
					.map( ( item ) => (
						<Button
							key={ item.category }
							className="modal-kit-wizard__chip"
							isPressed={ filter === item.category }
							onClick={ () => setFilter( item.category ) }
						>
							{ item.short ?? item.label }
						</Button>
					) ) }
			</div>
			<div
				className="modal-kit-wizard__starters"
				role="radiogroup"
				aria-label={ __( 'Starters', 'modal-kit' ) }
			>
				{ visible.map( ( pattern ) => {
					const layout = layoutOf( pattern.content );
					const kind = kindOf( pattern );

					return (
						<button
							type="button"
							key={ pattern.name }
							role="radio"
							aria-checked={ selected?.name === pattern.name }
							className="modal-kit-wizard__starter"
							onClick={ () => setSelected( pattern ) }
						>
							<span
								className="modal-kit-wizard__starter-preview"
								aria-hidden="true"
							>
								<StarterPreview
									layout={ layout }
									look={ look }
									{ ...textOf( pattern.content ) }
								/>
							</span>
							<span className="modal-kit-wizard__starter-meta">
								<strong>{ pattern.title }</strong>
								<span>
									{ [ LAYOUT_LABELS[ layout ], kind ]
										.filter( Boolean )
										.join( ' · ' ) }
								</span>
							</span>
						</button>
					);
				} ) }
				{ proDrawer && (
					<div className="modal-kit-wizard__starter is-pro">
						<span
							className="modal-kit-wizard__starter-preview"
							aria-hidden="true"
						>
							<span
								className="modal-kit-wizard__mini is-drawer"
								style={ {
									background: COLORS.base,
									color: COLORS.contrast,
								} }
							>
								<span className="modal-kit-wizard__mini-heading">
									{ __( 'Added ✓', 'modal-kit' ) }
								</span>
								<span className="modal-kit-wizard__mini-line" />
								<span className="modal-kit-wizard__mini-progress">
									<span
										style={ { background: COLORS.button } }
									/>
								</span>
							</span>
						</span>
						<span className="modal-kit-wizard__starter-meta">
							<strong>
								{ __( 'Added-to-cart drawer', 'modal-kit' ) }
							</strong>
							<span>
								{ __( 'Drawer · WooCommerce', 'modal-kit' ) }{ ' ' }
								<span className="modal-kit-pro-badge">
									{ __( 'PRO', 'modal-kit' ) }
								</span>
							</span>
						</span>
						<ExternalLink href={ `${ data.proUrl }#woocommerce` }>
							{ __(
								'About WooCommerce in Modal Kit Pro',
								'modal-kit'
							) }
						</ExternalLink>
					</div>
				) }
				<button
					type="button"
					role="radio"
					aria-checked={ selected?.name === 'blank' }
					className="modal-kit-wizard__starter is-blank"
					onClick={ () =>
						setSelected( {
							name: 'blank',
							title: __( 'Blank modal', 'modal-kit' ),
						} )
					}
				>
					<span
						className="modal-kit-wizard__starter-preview"
						aria-hidden="true"
					>
						<span className="modal-kit-wizard__plus">+</span>
					</span>
					<span className="modal-kit-wizard__starter-meta">
						<strong>{ __( 'Start blank', 'modal-kit' ) }</strong>
						<span>{ __( 'Any layout', 'modal-kit' ) }</span>
					</span>
				</button>
			</div>
		</>
	);
}

function Wizard() {
	const settings = data.settings ?? {};
	const [ step, setStep ] = useState( 0 );
	const [ useCases, setUseCases ] = useState( [
		'newsletter',
		'promotions',
		'exit',
		...( data.woocommerce ? [ 'woocommerce' ] : [] ),
	] );
	const [ style, setStyle ] = useState(
		settings.display?.defaultStyle ?? 'default'
	);
	const [ mobile, setMobile ] = useState(
		settings.display?.defaultMobile === 'auto'
			? 'sheet'
			: ( settings.display?.defaultMobile ?? 'sheet' )
	);
	const [ behaviour, setBehaviour ] = useState( {
		autoOpenLimit: settings.general?.autoOpenLimit ?? 1,
		waitDays: settings.general?.defaultWaitDays ?? 7,
		hideAdmins: ( settings.general?.hideForRoles ?? [] ).includes(
			'administrator'
		),
		fade: settings.accessibility?.reducedMotion !== 'none',
	} );
	const [ selected, setSelected ] = useState( null );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	const done = () =>
		apiFetch( { path: '/modal-kit/v1/setup', method: 'POST' } );

	const saveSettings = () => {
		const roles = ( settings.general?.hideForRoles ?? [] ).filter(
			( role ) => role !== 'administrator'
		);

		return apiFetch( {
			path: '/wp/v2/settings',
			method: 'POST',
			data: {
				modal_kit_general: {
					...settings.general,
					autoOpenLimit: behaviour.autoOpenLimit,
					defaultWaitDays: behaviour.waitDays,
					hideForRoles: behaviour.hideAdmins
						? [ ...roles, 'administrator' ]
						: roles,
				},
				modal_kit_display: {
					...settings.display,
					defaultStyle: style,
					defaultMobile: mobile,
				},
				modal_kit_accessibility: {
					...settings.accessibility,
					reducedMotion: behaviour.fade ? 'fade' : 'none',
				},
			},
		} );
	};

	const exit = async () => {
		await done().catch( () => {} );
		window.location.href = data.listUrl;
	};

	const finish = async () => {
		setBusy( true );
		setError( '' );

		try {
			await saveSettings();
			await done();

			if ( ! selected || selected.name === 'blank' ) {
				window.location.href = addQueryArgs( data.newUrl, {
					mk_pattern: 'blank',
				} );
				return;
			}

			const post = await apiFetch( {
				path: '/wp/v2/mk_modal',
				method: 'POST',
				data: {
					title: selected.title,
					content: selected.content,
					status: 'draft',
				},
			} );

			window.location.href = addQueryArgs( 'post.php', {
				post: post.id,
				action: 'edit',
			} );
		} catch ( caught ) {
			setError(
				caught?.message ||
					__( 'Something went wrong. Try again.', 'modal-kit' )
			);
			setBusy( false );
		}
	};

	const next = async () => {
		if ( step === 2 ) {
			setBusy( true );
			await saveSettings().catch( () => {} );
			setBusy( false );
		}

		setStep( step + 1 );
	};

	return (
		<div className="modal-kit-wizard">
			<header className="modal-kit-wizard__header">
				<strong className="modal-kit-wizard__brand">
					<span
						className="modal-kit-wizard__mark"
						aria-hidden="true"
					/>
					{ __( 'Modal Kit setup', 'modal-kit' ) }
				</strong>
				<Stepper step={ step } />
				<Button
					variant="link"
					className="modal-kit-wizard__exit"
					onClick={ exit }
				>
					{ __( 'Exit setup', 'modal-kit' ) }
				</Button>
			</header>

			<main className="modal-kit-wizard__body">
				{ error && (
					<Notice status="error" isDismissible={ false }>
						{ error }
					</Notice>
				) }
				{ step === 0 && (
					<Welcome
						useCases={ useCases }
						setUseCases={ setUseCases }
					/>
				) }
				{ step === 1 && (
					<Look
						style={ style }
						setStyle={ setStyle }
						mobile={ mobile }
						setMobile={ setMobile }
					/>
				) }
				{ step === 2 && (
					<Behaviour
						behaviour={ behaviour }
						setBehaviour={ setBehaviour }
					/>
				) }
				{ step === 3 && (
					<FirstModal
						look={ style }
						useCases={ useCases }
						selected={ selected }
						setSelected={ setSelected }
					/>
				) }
			</main>

			<footer className="modal-kit-wizard__footer">
				{ step === 0 ? (
					<Button variant="tertiary" onClick={ exit }>
						{ __( 'Skip setup', 'modal-kit' ) }
					</Button>
				) : (
					<Button
						variant="tertiary"
						onClick={ () => setStep( step - 1 ) }
					>
						{ __( '← Back', 'modal-kit' ) }
					</Button>
				) }
				{ step === 3 && selected && (
					<span className="modal-kit-wizard__selected">
						{ sprintf(
							/* translators: %s: starter name. */
							__( '%s selected', 'modal-kit' ),
							selected.title
						) }
					</span>
				) }
				{ step < 3 ? (
					<Button
						variant="primary"
						onClick={ next }
						isBusy={ busy }
						disabled={ busy }
						__next40pxDefaultSize
					>
						{ __( 'Continue', 'modal-kit' ) }
					</Button>
				) : (
					<Button
						variant="primary"
						onClick={ finish }
						isBusy={ busy }
						disabled={ busy || ! selected }
						accessibleWhenDisabled
						__next40pxDefaultSize
					>
						{ __( 'Create and open in editor', 'modal-kit' ) }
					</Button>
				) }
			</footer>
		</div>
	);
}

domReady( () => {
	const root = document.getElementById( 'modal-kit-wizard' );

	if ( root ) {
		createRoot( root ).render( <Wizard /> );
	}
} );

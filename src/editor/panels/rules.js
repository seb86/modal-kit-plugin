/**
 * Display rules panel (mockup 1f): where, how often, on which devices and
 * browsers, when and for whom. Page targeting runs on the server; the rest in
 * the browser.
 */
import { __ } from '@wordpress/i18n';
import {
	BaseControl,
	Button,
	CheckboxControl,
	ExternalLink,
	RadioControl,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { useState } from '@wordpress/element';

import useModalMeta from './use-modal-meta';
import PageTokens from './page-tokens';
import { dismiss, listings } from '../upsell/dismiss';

const DEVICES = [
	[ 'desktop', __( 'Desktop', 'modal-kit' ) ],
	[ 'tablet', __( 'Tablet', 'modal-kit' ) ],
	[ 'mobile', __( 'Mobile', 'modal-kit' ) ],
];

// Ids match runtime/browser.js and the schema.
const BROWSERS = [
	[ 'chrome', __( 'Chrome', 'modal-kit' ) ],
	[ 'safari', __( 'Safari', 'modal-kit' ) ],
	[ 'firefox', __( 'Firefox', 'modal-kit' ) ],
	[ 'edge', __( 'Edge', 'modal-kit' ) ],
	[ 'opera', __( 'Opera', 'modal-kit' ) ],
	[ 'samsung', __( 'Samsung Internet', 'modal-kit' ) ],
	[ 'in-app', __( 'In-app browsers', 'modal-kit' ) ],
	[ 'other', __( 'Other', 'modal-kit' ) ],
];

/**
 * A Pro listing for rules the free plugin doesn't have (Upsell.php,
 * area "rules"). Pro removes it.
 */
function RulesListing() {
	const [ hidden, setHidden ] = useState( false );
	const [ listing ] = listings( 'rules' );

	if ( ! listing || hidden ) {
		return null;
	}

	return (
		<div className="modal-kit-rules-listing">
			<p>
				<b>{ listing.title }</b>{ ' ' }
				<span className="modal-kit-pro-badge">
					{ __( 'PRO', 'modal-kit' ) }
				</span>
			</p>
			<p className="modal-kit-panel__help">{ listing.description }</p>
			<p>
				<ExternalLink href={ listing.url }>
					{ __( 'See Pro', 'modal-kit' ) }
				</ExternalLink>
				{ ' · ' }
				<Button
					variant="link"
					onClick={ () => {
						setHidden( true );
						dismiss( listing.key );
					} }
				>
					{ __( 'Not now', 'modal-kit' ) }
				</Button>
			</p>
		</div>
	);
}

/**
 * A datetime-local value for an ISO date string, and back.
 *
 * @param {string} iso ISO date.
 * @return {string} yyyy-mm-ddThh:mm in local time.
 */
export function toLocalInput( iso ) {
	if ( ! iso ) {
		return '';
	}

	const date = new Date( iso );

	if ( Number.isNaN( date.getTime() ) ) {
		return '';
	}

	const offset = date.getTimezoneOffset() * 60000;

	return new Date( date.getTime() - offset ).toISOString().slice( 0, 16 );
}

/**
 * @param {string} local yyyy-mm-ddThh:mm in local time.
 * @return {string} ISO date, or ''.
 */
export function fromLocalInput( local ) {
	if ( ! local ) {
		return '';
	}

	const date = new Date( local );

	return Number.isNaN( date.getTime() ) ? '' : date.toISOString();
}

export default function RulesPanel() {
	const [ rules, setRules ] = useModalMeta( 'rules' );
	// Exceptions only change anything inside a listed section ("/shop/*").
	const listsSection = rules.showOn.include.some( ( entry ) =>
		String( entry ).trim().endsWith( '*' )
	);

	const set = ( part, changes ) =>
		setRules( { ...rules, [ part ]: { ...rules[ part ], ...changes } } );

	const toggleDevice = ( device, on ) =>
		setRules( {
			...rules,
			devices: on
				? [ ...new Set( [ ...rules.devices, device ] ) ]
				: rules.devices.filter( ( d ) => d !== device ),
		} );

	const toggleBrowser = ( browser, on ) =>
		set( 'browsers', {
			list: on
				? [ ...new Set( [ ...rules.browsers.list, browser ] ) ]
				: rules.browsers.list.filter( ( b ) => b !== browser ),
		} );

	return (
		<PluginDocumentSettingPanel
			name="modal-kit-rules"
			title={ __( 'Display rules', 'modal-kit' ) }
			className="modal-kit-panel"
		>
			<RadioControl
				label={ __( 'Show on', 'modal-kit' ) }
				selected={ rules.showOn.mode }
				options={ [
					{ value: 'all', label: __( 'Entire site', 'modal-kit' ) },
					{
						value: 'include',
						label: __( 'Only these pages', 'modal-kit' ),
					},
					{
						value: 'exclude',
						label: __( 'Everywhere except', 'modal-kit' ),
					},
				] }
				onChange={ ( mode ) => set( 'showOn', { mode } ) }
			/>
			{ rules.showOn.mode === 'include' && (
				<PageTokens
					label={ __( 'Pages', 'modal-kit' ) }
					value={ rules.showOn.include }
					onChange={ ( include ) => set( 'showOn', { include } ) }
				/>
			) }
			{ rules.showOn.mode === 'include' && listsSection && (
				<PageTokens
					label={ __( 'Except', 'modal-kit' ) }
					help={ __(
						'Pages inside those sections to leave out.',
						'modal-kit'
					) }
					value={ rules.showOn.exclude }
					onChange={ ( exclude ) => set( 'showOn', { exclude } ) }
				/>
			) }
			{ rules.showOn.mode === 'exclude' && (
				<PageTokens
					label={ __( 'Except these pages', 'modal-kit' ) }
					value={ rules.showOn.exclude }
					onChange={ ( exclude ) => set( 'showOn', { exclude } ) }
				/>
			) }

			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Frequency', 'modal-kit' ) }
				value={ rules.frequency.mode }
				options={ [
					{
						value: 'session',
						label: __( 'Once per visit', 'modal-kit' ),
					},
					{
						value: 'days',
						label: __( 'Once every few days', 'modal-kit' ),
					},
					{ value: 'always', label: __( 'Every time', 'modal-kit' ) },
				] }
				onChange={ ( mode ) => set( 'frequency', { mode } ) }
			/>
			{ rules.frequency.mode === 'days' && (
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					type="number"
					min={ 1 }
					max={ 365 }
					label={ __( 'Days', 'modal-kit' ) }
					value={ rules.frequency.days }
					onChange={ ( days ) =>
						set( 'frequency', {
							days: Math.min(
								365,
								Math.max( 1, parseInt( days, 10 ) || 1 )
							),
						} )
					}
				/>
			) }
			<CheckboxControl
				__nextHasNoMarginBottom
				label={ __(
					'Stop after the visitor clicks a button',
					'modal-kit'
				) }
				checked={ !! rules.frequency.stopAfterCta }
				onChange={ ( stopAfterCta ) =>
					set( 'frequency', { stopAfterCta } )
				}
			/>
			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				type="number"
				min={ 0 }
				max={ 100 }
				label={ __( 'At most this many times in total', 'modal-kit' ) }
				help={ __(
					'0 means no limit. Counts the times it opened by itself; links and buttons always open it.',
					'modal-kit'
				) }
				value={ rules.frequency.maxShows }
				onChange={ ( shows ) =>
					set( 'frequency', {
						maxShows: Math.min(
							100,
							Math.max( 0, parseInt( shows, 10 ) || 0 )
						),
					} )
				}
			/>

			<BaseControl
				__nextHasNoMarginBottom
				id="modal-kit-devices"
				label={ __( 'Devices', 'modal-kit' ) }
			>
				<div
					id="modal-kit-devices"
					className="modal-kit-devices"
					role="group"
					aria-label={ __( 'Devices', 'modal-kit' ) }
				>
					{ DEVICES.map( ( [ device, label ] ) => (
						<Button
							key={ device }
							isPressed={ rules.devices.includes( device ) }
							onClick={ () =>
								toggleDevice(
									device,
									! rules.devices.includes( device )
								)
							}
							__next40pxDefaultSize
						>
							{ label }
						</Button>
					) ) }
				</div>
			</BaseControl>

			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Browsers', 'modal-kit' ) }
				value={ rules.browsers.mode }
				options={ [
					{ value: 'all', label: __( 'All browsers', 'modal-kit' ) },
					{ value: 'only', label: __( 'Only these', 'modal-kit' ) },
					{
						value: 'except',
						label: __( 'All except these', 'modal-kit' ),
					},
				] }
				help={
					rules.browsers.mode === 'all'
						? undefined
						: __(
								'Checked in the visitor’s browser. Brave counts as Chrome; in-app browsers are the ones inside Facebook, Instagram, TikTok and similar apps.',
								'modal-kit'
							)
				}
				onChange={ ( mode ) => set( 'browsers', { mode } ) }
			/>
			{ rules.browsers.mode !== 'all' && (
				<div
					className="modal-kit-devices modal-kit-browsers"
					role="group"
					aria-label={ __( 'Browsers', 'modal-kit' ) }
				>
					{ BROWSERS.map( ( [ browser, label ] ) => (
						<Button
							key={ browser }
							isPressed={ rules.browsers.list.includes(
								browser
							) }
							onClick={ () =>
								toggleBrowser(
									browser,
									! rules.browsers.list.includes( browser )
								)
							}
							__next40pxDefaultSize
						>
							{ label }
						</Button>
					) ) }
				</div>
			) }

			<fieldset className="modal-kit-schedule">
				<legend>{ __( 'Schedule', 'modal-kit' ) }</legend>
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					type="datetime-local"
					label={ __( 'Start', 'modal-kit' ) }
					value={ toLocalInput( rules.schedule.start ) }
					onChange={ ( start ) =>
						set( 'schedule', { start: fromLocalInput( start ) } )
					}
				/>
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					type="datetime-local"
					label={ __( 'End', 'modal-kit' ) }
					value={ toLocalInput( rules.schedule.end ) }
					onChange={ ( end ) =>
						set( 'schedule', { end: fromLocalInput( end ) } )
					}
				/>
				<p className="modal-kit-panel__help">
					{ __(
						'Checked in the visitor’s browser, so it works on static sites. The modal is already in the page, so this won’t keep a code secret until the start date.',
						'modal-kit'
					) }
				</p>
			</fieldset>

			<fieldset className="modal-kit-visitors">
				<legend>{ __( 'Visitors', 'modal-kit' ) }</legend>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Hide for logged-in users', 'modal-kit' ) }
					help={
						rules.visitors.hideLoggedIn
							? __(
									'Not shown to logged-in users at all, not even from links. Check it with ?modal=preview.',
									'modal-kit'
								)
							: undefined
					}
					checked={ !! rules.visitors.hideLoggedIn }
					onChange={ ( hideLoggedIn ) =>
						set( 'visitors', { hideLoggedIn } )
					}
				/>
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					type="number"
					min={ 0 }
					max={ 100 }
					label={ __(
						'Only after this many page views',
						'modal-kit'
					) }
					help={ __(
						'0 shows it from the first page.',
						'modal-kit'
					) }
					value={ rules.visitors.minPageViews }
					onChange={ ( views ) =>
						set( 'visitors', {
							minPageViews: Math.min(
								100,
								Math.max( 0, parseInt( views, 10 ) || 0 )
							),
						} )
					}
				/>
				<RulesListing />
			</fieldset>
		</PluginDocumentSettingPanel>
	);
}

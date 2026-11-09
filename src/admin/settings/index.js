/**
 * Settings screen: one page, tabs in the URL
 * hash, saved through the Settings API (REST /wp/v2/settings via core-data).
 */
import { __ } from '@wordpress/i18n';
import { Button, Notice, Spinner } from '@wordpress/components';
import { store as coreStore, useEntityRecord } from '@wordpress/core-data';
import { useDispatch } from '@wordpress/data';
import domReady from '@wordpress/dom-ready';
import { createRoot, useEffect, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';

import General from './general';
import Display from './display';
import Accessibility from './accessibility';
import Tools from './tools';
import Styles from './styles';
import Pro from './pro';
import './style.scss';

/**
 * Tabs, in order. Modal Kit Pro filters this to add Integrations and to
 * replace Pro with License.
 *
 * @return {Object[]} { name, title, Component, saves }.
 */
function getTabs() {
	return applyFilters( 'modalKit.settingsTabs', [
		{
			name: 'general',
			title: __( 'General', 'modal-kit' ),
			Component: General,
		},
		{
			name: 'display',
			title: __( 'Display', 'modal-kit' ),
			Component: Display,
		},
		{
			name: 'accessibility',
			title: __( 'Accessibility', 'modal-kit' ),
			Component: Accessibility,
		},
		{
			name: 'styles',
			title: __( 'Styles', 'modal-kit' ),
			Component: Styles,
			saves: false,
		},
		{ name: 'tools', title: __( 'Tools', 'modal-kit' ), Component: Tools },
		{ name: 'pro', title: __( 'Pro', 'modal-kit' ), Component: Pro },
	] );
}

function currentTab( tabs ) {
	const hash = window.location.hash.replace( '#', '' );

	return tabs.some( ( tab ) => tab.name === hash ) ? hash : tabs[ 0 ].name;
}

function App() {
	const tabs = getTabs();
	const [ tab, setTab ] = useState( () => currentTab( tabs ) );
	const [ notice, setNotice ] = useState( null );
	const { record, hasEdits, isSaving } = useEntityRecord( 'root', 'site' );
	const { saveEditedEntityRecord } = useDispatch( coreStore );

	useEffect( () => {
		// A notice ("Settings saved.") is about the tab it came from.
		const onHash = () => {
			setTab( currentTab( tabs ) );
			setNotice( null );
		};
		window.addEventListener( 'hashchange', onHash );
		return () => window.removeEventListener( 'hashchange', onHash );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const notify = ( status, message ) => setNotice( { status, message } );

	const save = async () => {
		try {
			await saveEditedEntityRecord( 'root', 'site', undefined, {
				throwOnError: true,
			} );
			notify( 'success', __( 'Settings saved.', 'modal-kit' ) );
		} catch ( error ) {
			notify(
				'error',
				error?.message ||
					__( 'Couldn’t save the settings.', 'modal-kit' )
			);
		}
	};

	const active = tabs.find( ( item ) => item.name === tab ) ?? tabs[ 0 ];

	// Edits made before the settings load would be lost.
	if ( ! record ) {
		return <Spinner />;
	}

	return (
		<>
			<nav
				className="nav-tab-wrapper"
				aria-label={ __( 'Settings sections', 'modal-kit' ) }
			>
				{ tabs.map( ( item ) => (
					<a
						key={ item.name }
						href={ `#${ item.name }` }
						className={ `nav-tab${ item.name === tab ? ' nav-tab-active' : '' }` }
						aria-current={ item.name === tab ? 'page' : undefined }
					>
						{ item.title }
					</a>
				) ) }
			</nav>

			{ notice && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( null ) }
					className="modal-kit-settings__notice"
				>
					{ notice.message }
				</Notice>
			) }

			<div
				className="modal-kit-settings__panel"
				id={ `modal-kit-tab-${ active.name }` }
			>
				<active.Component notify={ notify } />
			</div>

			{ active.saves !== false && (
				<p className="submit">
					<Button
						variant="primary"
						onClick={ save }
						isBusy={ isSaving }
						disabled={ ! hasEdits || isSaving }
						accessibleWhenDisabled
						__next40pxDefaultSize
					>
						{ __( 'Save Changes', 'modal-kit' ) }
					</Button>
				</p>
			) }
		</>
	);
}

domReady( () => {
	const root = document.getElementById( 'modal-kit-settings' );

	if ( root ) {
		createRoot( root ).render( <App /> );
	}
} );

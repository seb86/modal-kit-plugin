/**
 * Editor view of the Modal block.
 *
 * The block wrapper plays the role the <dialog> plays on the front end
 * (.modal-kit container), and an inner element is the panel. Block-support
 * classes and styles move from the wrapper to the panel, so style.scss sees
 * the same "container > panel" structure in the editor and on the site.
 */
import { __ } from '@wordpress/i18n';
import {
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { useMergeRefs, useRefEffect } from '@wordpress/compose';
import { useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';

import { containerClasses, containerStyle, resolve } from './layouts';
import Inspector from './inspector';
import { STORE as PREVIEW, withStyle } from '../../styles/preview';
import './editor.scss';

const TEMPLATE = [
	[
		'core/heading',
		{ level: 2, placeholder: __( 'Modal heading', 'modal-kit' ) },
	],
	[
		'core/paragraph',
		{ placeholder: __( 'Write something, or add blocks…', 'modal-kit' ) },
	],
];

// Wrapper classes that belong to the editor, not to block supports.
const EDITOR_CLASS =
	/^(block-editor-|wp-block$|is-selected$|is-hovered$|is-multi-selected$|is-highlighted$|is-reusable$|is-editing-disabled$|is-typing$|is-focus-mode$|is-content-locked|is-block-moving|has-child-selected$|has-warning$|has-editable-outline$|has-active-entity$|is-outline-mode$|rich-text$)/;

const BACKDROP_KEY = 'modal-kit:editor-backdrop';

function readBackdrop() {
	try {
		return window.localStorage.getItem( BACKDROP_KEY ) === 'plain'
			? 'plain'
			: 'site';
	} catch {
		return 'site';
	}
}

/**
 * Splits useBlockProps output into wrapper (editor) and panel (supports) props.
 *
 * @param {Object} blockProps useBlockProps() result.
 * @return {Object} { wrapper, panelClassName, panelStyle }
 */
function splitBlockProps( blockProps ) {
	const { className = '', style, ...wrapper } = blockProps;
	const editorClasses = [];
	const panelClasses = [];

	className
		.split( /\s+/ )
		.filter( Boolean )
		.forEach( ( name ) =>
			( EDITOR_CLASS.test( name ) ? editorClasses : panelClasses ).push(
				name
			)
		);

	return {
		wrapper: { ...wrapper, className: editorClasses.join( ' ' ) },
		panelClassName: panelClasses.join( ' ' ),
		panelStyle: style,
	};
}

function CloseButton( { options } ) {
	if ( ! options.button ) {
		return null;
	}

	const label = __( 'Close', 'modal-kit' );

	return (
		<button
			type="button"
			className={
				'modal-kit__close' +
				( options.visibleLabel ? ' has-label' : '' )
			}
			aria-label={ options.visibleLabel ? undefined : label }
			tabIndex={ -1 }
			onClick={ ( event ) => event.preventDefault() }
		>
			{ options.visibleLabel && (
				<span className="modal-kit__close-label">{ label }</span>
			) }
			<svg
				className="modal-kit__close-icon"
				viewBox="0 0 24 24"
				width="20"
				height="20"
				aria-hidden="true"
				focusable="false"
			>
				<path
					d="M6 6l12 12M18 6L6 18"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
				/>
			</svg>
		</button>
	);
}

export default function Edit( { attributes, setAttributes, clientId } ) {
	// A style previewed from the picker (13a) draws in place of the saved one.
	const { previewed, previewOptions } = useSelect(
		( select ) => ( {
			previewed: select( PREVIEW ).get( clientId ),
			previewOptions: select( PREVIEW ).getOptions( clientId ),
		} ),
		[ clientId ]
	);
	const saved = resolve( attributes );
	const resolved = previewed
		? resolve( {
				...attributes,
				className: withStyle( attributes.className, previewed ),
				...( previewOptions ? { styleOptions: previewOptions } : {} ),
			} )
		: saved;
	const [ backdrop, setBackdrop ] = useState( readBackdrop );
	const [ homepageLoaded, setHomepageLoaded ] = useState( false );
	// Pattern previews size themselves to their content: give them a fixed stage.
	const isPreview = useSelect(
		( select ) => !! select( blockEditorStore ).getSettings().isPreviewMode,
		[]
	);

	// The real homepage behind the modal ("Site preview"), for editors and
	// administrators; others see a sketch of a page. Not in pattern
	// previews, which render many modals at once.
	const homepageUrl = window.modalKitEditor?.backdropUrl ?? '';
	const showHomepage = backdrop === 'site' && !! homepageUrl && ! isPreview;

	const blockProps = splitBlockProps( useBlockProps() );
	const { wrapper, panelStyle } = blockProps;
	const panelClassName = previewed
		? withStyle( blockProps.panelClassName, previewed )
		: blockProps.panelClassName;

	const innerBlocksProps = useInnerBlocksProps(
		{
			className: `${ panelClassName } modal-kit__panel`,
			style: panelStyle,
		},
		{
			template: TEMPLATE,
			templateLock: false,
			layout: attributes.layout ?? { type: 'constrained' },
		}
	);

	const [ isMobile, setIsMobile ] = useState( false );
	const breakpoint = window.modalKitEditor?.breakpoint ?? 600;

	// Mark the canvas body so editor.scss can turn it into the modal stage,
	// and follow the canvas width for mobile layouts (device preview).
	const stageRef = useRefEffect(
		( node ) => {
			const classes = [ 'modal-kit-stage', `is-backdrop-${ backdrop }` ];
			const body = node.ownerDocument.body;
			const view = node.ownerDocument.defaultView;
			const observer = new view.ResizeObserver( ( [ entry ] ) =>
				setIsMobile( entry.contentRect.width < breakpoint )
			);

			body.classList.add( ...classes );
			observer.observe( node );

			return () => {
				body.classList.remove( ...classes );
				observer.disconnect();
			};
		},
		[ backdrop, breakpoint ]
	);
	const ref = useMergeRefs( [ wrapper.ref, stageRef ] );

	const changeBackdrop = ( value ) => {
		setBackdrop( value );
		setHomepageLoaded( false );
		try {
			window.localStorage.setItem( BACKDROP_KEY, value );
		} catch {}
	};

	return (
		<>
			<Inspector
				attributes={ attributes }
				resolved={ saved }
				clientId={ clientId }
				setAttributes={ setAttributes }
				backdrop={ backdrop }
				setBackdrop={ changeBackdrop }
			/>
			<div
				{ ...wrapper }
				ref={ ref }
				className={ [
					wrapper.className,
					...containerClasses( resolved ),
					'is-editor-preview',
					isPreview && 'is-preview',
					isMobile && 'is-mobile',
					showHomepage && homepageLoaded && 'has-homepage',
				]
					.filter( Boolean )
					.join( ' ' ) }
				style={ containerStyle( resolved ) }
			>
				{ showHomepage && (
					<iframe
						className="modal-kit-editor-homepage"
						title={ __(
							'Your homepage, behind the modal',
							'modal-kit'
						) }
						src={ homepageUrl }
						// No scripts: nothing runs, so no analytics fire.
						sandbox="allow-same-origin"
						scrolling="no"
						tabIndex={ -1 }
						aria-hidden="true"
						onLoad={ () => setHomepageLoaded( true ) }
					/>
				) }
				{
					/* Editor chrome from add-ons, e.g. step tabs (Modal Kit Pro). */
					applyFilters( 'modalKit.canvasChrome', null, {
						clientId,
						attributes,
						setAttributes,
					} )
				}
				<div { ...innerBlocksProps }>
					{ innerBlocksProps.children }
					<CloseButton options={ resolved.closeOptions } />
				</div>
			</div>
		</>
	);
}

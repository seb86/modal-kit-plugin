/**
 * Registers the Modal block.
 */
import {
	registerBlockType,
	store as blocksStore,
	unregisterBlockStyle,
} from '@wordpress/blocks';
import { select, subscribe } from '@wordpress/data';
import domReady from '@wordpress/dom-ready';
import { InnerBlocks } from '@wordpress/block-editor';

import './style.scss';
import Edit from './edit';
import metadata from './block.json';

registerBlockType( metadata.name, {
	edit: Edit,
	// Dynamic block: PHP renders the dialog, but inner blocks still need saving.
	save: () => <InnerBlocks.Content />,
} );

// The style picker replaces core's block style buttons for this block.
// Block styles stay registered on the server, where `is-style-*` classes are
// read, and the block keeps its className; only the buttons go.
function dropStyleButtons() {
	for ( const style of select( blocksStore ).getBlockStyles(
		metadata.name
	) ?? [] ) {
		unregisterBlockStyle( metadata.name, style.name );
	}
}

domReady( () => {
	dropStyleButtons();
	// Styles registered later (by a plugin's script) go too.
	subscribe( () => {
		if ( select( blocksStore ).getBlockStyles( metadata.name )?.length ) {
			dropStyleButtons();
		}
	}, blocksStore );
} );

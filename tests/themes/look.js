/**
 * Reads a panel's computed styles as text, one value per line, so a difference
 * between two themes shows as a plain diff that names the element and property.
 *
 * Sizes that follow the content (width, height) are left to the screenshots.
 */

const SIDES = [ 'top', 'right', 'bottom', 'left' ];

const PROPERTIES = [
	'color',
	'background-color',
	'font-family',
	'font-size',
	'font-style',
	'font-weight',
	'letter-spacing',
	'line-height',
	'list-style-type',
	'min-height',
	'opacity',
	'outline-style',
	'outline-width',
	'text-align',
	'text-decoration-line',
	'text-shadow',
	'text-transform',
	'text-wrap-mode',
	'text-wrap-style',
	'word-break',
	'word-spacing',
	'overflow-wrap',
	'hyphens',
	'box-shadow',
	'column-gap',
	'display',
	...SIDES.flatMap( ( side ) => [
		`margin-${ side }`,
		`padding-${ side }`,
		`border-${ side }-color`,
		`border-${ side }-style`,
		`border-${ side }-width`,
	] ),
	'border-top-left-radius',
	'border-bottom-right-radius',
];

const STATE_PROPERTIES = [
	'color',
	'background-color',
	'border-top-color',
	'box-shadow',
	'outline-color',
	'outline-offset',
	'outline-style',
	'outline-width',
	'text-decoration-line',
];

const ELEMENTS = {
	panel: '.modal-kit__panel',
	close: '.modal-kit__close',
	eyebrow: '.modal-kit__panel > p:first-of-type',
	h2: '.modal-kit__panel h2',
	h3: '.modal-kit__panel h3',
	paragraph: '.modal-kit__panel > h3 + p',
	link: '.modal-kit__panel > h3 + p a',
	code: '.modal-kit__panel code',
	buttons: '.modal-kit__panel .wp-block-buttons',
	button: '.wp-block-button:not(.is-style-outline) .wp-block-button__link',
	outline: '.wp-block-button.is-style-outline .wp-block-button__link',
	list: '.modal-kit__panel ul',
	'list item': '.modal-kit__panel li',
	quote: '.modal-kit__panel blockquote',
	'quote text': '.modal-kit__panel blockquote p',
	separator: '.modal-kit__panel hr',
	table: '.modal-kit__panel table',
	'table cell': '.modal-kit__panel td',
	summary: '.modal-kit__panel summary',
	'field label': '.modal-kit__panel .wp-block-search__label',
	field: '.modal-kit__panel input[type="search"]',
	'field button': '.modal-kit__panel .wp-block-search__button',
};

const INTERACTIVE = [ 'close', 'link', 'button', 'outline', 'field button' ];

/**
 * Reads computed styles in the page.
 *
 * @param {Object}   dialog     Dialog locator.
 * @param {Object}   elements   Name to selector.
 * @param {string[]} properties CSS properties.
 * @param {string}   prefix     Line prefix.
 * @return {Promise<string[]>} Lines.
 */
function read( dialog, elements, properties, prefix = '' ) {
	return dialog.evaluate(
		( node, args ) => {
			const lines = [];

			for ( const [ name, selector ] of Object.entries(
				args.elements
			) ) {
				const element = node.querySelector( selector );

				if ( ! element ) {
					lines.push( `${ args.prefix }${ name }: missing` );
					continue;
				}

				const style = window.getComputedStyle( element );

				for ( const property of args.properties ) {
					// A width or color means nothing without a line to draw.
					const line = property.match(
						/^(outline|border-\w+)-(color|offset|width)$/
					);

					if (
						line &&
						style.getPropertyValue( `${ line[ 1 ] }-style` ) ===
							'none'
					) {
						continue;
					}

					lines.push(
						`${ args.prefix }${ name } ${ property }: ${ style.getPropertyValue(
							property
						) }`
					);
				}
			}

			return lines;
		},
		{ elements, properties, prefix }
	);
}

/**
 * A panel's look, at rest and with each control hovered and focused.
 *
 * @param {Object} page   Playwright page.
 * @param {Object} dialog Dialog locator.
 * @return {Promise<string>} One `element property: value` per line.
 */
async function readLook( page, dialog ) {
	const lines = await read( dialog, ELEMENTS, PROPERTIES );

	for ( const name of INTERACTIVE ) {
		const selector = ELEMENTS[ name ];
		const control = dialog.locator( selector ).first();
		const only = { [ name ]: selector };

		await control.hover();
		lines.push(
			...( await read( dialog, only, STATE_PROPERTIES, 'hover ' ) )
		);
		await page.mouse.move( 0, 0 );

		await control.focus();
		lines.push(
			...( await read( dialog, only, STATE_PROPERTIES, 'focus ' ) )
		);
		await control.blur();
	}

	return `${ lines.join( '\n' ) }\n`;
}

module.exports = { readLook };

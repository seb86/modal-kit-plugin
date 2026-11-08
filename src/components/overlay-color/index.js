/**
 * Overlay color, like core's Background color control: a row that opens the
 * palettes and the custom color picker. A palette pick is kept as its slug
 * (it follows the theme); anything else as a color value. Used by the Modal
 * block (Styles → Overlay) and Settings → Display. Styles: _style.scss,
 * imported by each screen's stylesheet.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	ColorIndicator,
	ColorPalette,
	Dropdown,
} from '@wordpress/components';

/**
 * @param {Object}                                                props               Props.
 * @param {Object[]}                                              props.origins       Palettes: { name, colors }.
 * @param {string}                                                props.color         Palette slug, or ''.
 * @param {string}                                                props.customColor   Custom color value, or ''.
 * @param {boolean}                                               [props.allowCustom] Offer the custom color picker.
 * @param {string}                                                [props.placement]   Popover placement (left of a sidebar by default).
 * @param {(value: {color: string, customColor: string}) => void} props.onChange      Receives the new color.
 * @return {Element} Control.
 */
export default function OverlayColor( {
	origins,
	color,
	customColor,
	allowCustom = true,
	placement = 'left-start',
	onChange,
} ) {
	const all = origins.flatMap( ( origin ) => origin.colors );
	const picked = color
		? all.find( ( item ) => item.slug === color )
		: undefined;
	const value = color ? picked?.color : customColor || undefined;
	const name = color ? picked?.name : customColor;

	return (
		<Dropdown
			className="modal-kit-overlay-color"
			popoverProps={ {
				placement,
				offset: placement.startsWith( 'left' ) ? 36 : 8,
				shift: true,
			} }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					className="modal-kit-overlay-color__toggle"
					onClick={ onToggle }
					aria-expanded={ isOpen }
					aria-label={
						name
							? sprintf(
									/* translators: %s: color name or value. */
									__( 'Overlay color: %s', 'modal-kit' ),
									name
								)
							: __( 'Overlay color: text color', 'modal-kit' )
					}
				>
					<ColorIndicator colorValue={ value } />
					<span>{ __( 'Color', 'modal-kit' ) }</span>
				</Button>
			) }
			renderContent={ () => (
				<div className="modal-kit-overlay-color__popover">
					<ColorPalette
						colors={ origins }
						value={ value }
						enableAlpha
						clearable
						disableCustomColors={ ! allowCustom }
						onChange={ ( next ) => {
							const match = all.find(
								( item ) => item.color === next
							);

							onChange(
								match
									? { color: match.slug, customColor: '' }
									: { color: '', customColor: next ?? '' }
							);
						} }
					/>
				</div>
			) }
		/>
	);
}

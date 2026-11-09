/**
 * Layout glyphs (brand/glyphs): the mark's frame with the panel moved to each
 * layout's position. Drawn on a 24px grid from the em spec in
 * PROJECT-GUIDELINES.md. Split is derived: a centered panel, media half filled.
 */
import { Path, SVG, Rect } from '@wordpress/primitives';

import { allLayouts } from './layouts';

const FRAME = (
	<Rect
		x="1.25"
		y="1.25"
		width="21.5"
		height="21.5"
		rx="5"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
	/>
);

const PANELS = {
	centered: <Rect x="3.6" y="5.52" width="16.8" height="12.96" rx="1.2" />,
	corner: <Rect x="14.4" y="16.4" width="8" height="6" rx="1.2" />,
	bar: <Rect x="1.2" y="1.2" width="21.6" height="3.2" rx="1.2" />,
	'bar-bottom': <Rect x="1.2" y="19.6" width="21.6" height="3.2" rx="1.2" />,
	full: <Rect x="1.2" y="1.2" width="21.6" height="21.6" rx="1.2" />,
	drawer: <Rect x="16" y="1.2" width="6.8" height="21.6" rx="1.2" />,
	split: (
		<>
			<Rect x="3.6" y="5.52" width="8.4" height="12.96" rx="1.2" />
			<Rect
				x="12.6"
				y="6.12"
				width="7.2"
				height="11.76"
				rx="0.8"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
		</>
	),
	sheet: <Rect x="1.2" y="13.6" width="21.6" height="9.2" rx="1.2" />,
	inline: <Rect x="2.8" y="7.2" width="18.4" height="4.8" rx="1.2" />,
	// Derived: the full-screen panel with a play triangle cut out.
	video: (
		<Path
			fillRule="evenodd"
			d="M2.4 1.2h19.2a1.2 1.2 0 0 1 1.2 1.2v19.2a1.2 1.2 0 0 1-1.2 1.2H2.4a1.2 1.2 0 0 1-1.2-1.2V2.4a1.2 1.2 0 0 1 1.2-1.2zM10 8.5v7l5.5-3.5z"
		/>
	),
};

/**
 * Glyph icon for a layout.
 *
 * @param {Object} props        Props.
 * @param {string} props.layout Layout name (or bar-bottom).
 * @return {Element} SVG.
 */
export default function Glyph( { layout } ) {
	return (
		<SVG viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
			{ FRAME }
			<g fill="currentColor">
				{ PANELS[ layout ] ??
					PANELS[ allLayouts()[ layout ]?.base ] ??
					PANELS.centered }
			</g>
		</SVG>
	);
}

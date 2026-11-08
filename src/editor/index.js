/**
 * Editor bundle for the modal post type: pattern picker, button actions and
 * the Modal sidebar panels (Triggers, Display rules, Accessibility).
 */
import { registerPlugin } from '@wordpress/plugins';

import PatternPickerLauncher from './pattern-picker';
import TriggersPanel from './panels/triggers';
import RulesPanel from './panels/rules';
import AccessibilityPanel from './panels/accessibility';
import VideoPanel from './panels/video';
import '../extensions/button-action';
import './upsell';
import './panels/style.scss';

registerPlugin( 'modal-kit-pattern-picker', {
	render: PatternPickerLauncher,
} );

registerPlugin( 'modal-kit-triggers', { render: TriggersPanel } );
registerPlugin( 'modal-kit-rules', { render: RulesPanel } );
registerPlugin( 'modal-kit-accessibility', { render: AccessibilityPanel } );
registerPlugin( 'modal-kit-video', { render: VideoPanel } );

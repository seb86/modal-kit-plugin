# Modal Kit: instructions for Claude Code

The free plugin (slug and text domain `modal-kit`), published on WordPress.org. The plugin is the repo root. `.github/README.md` has the commands (a root README would ship in the zip).

The workspace's `CLAUDE.md` and `planning/` folder sit one level up: the plan, mockups (`planning/design/`) and decisions (`planning/notes/BUILD-NOTES.md`). Read the notes first and record decisions there.

## Non-negotiables
1. One custom block, `modal-kit/modal`. Everything inside it is core blocks.
2. Editor = front end: one shared `style.scss` for the canvas and the site. `editor.scss` is editor chrome only.
3. Static-export safe: opening, showing and closing a modal never needs a request to WordPress. Time, device and visitor rules run in the browser. Store state in localStorage, never cookies.
4. Native `<dialog>` and the Interactivity API (`viewScriptModule`). No jQuery, no third-party UI libraries.
5. This plugin contains no Pro code. Upgrade prompts are listings filtered by Pro (`modal_kit_pro_listings`), shown only on our own screens and block, and dismissible.
6. Accessibility is built in: focus moves to the heading on open and returns to the trigger on close, the page behind is inert, tap targets are at least 44px, and reduced motion gets a fade only.
7. Theme-native (mockup 1a) is the default style. Use theme.json preset slugs, never hard-coded colours, in styles and patterns.

## Standards
- Baseline: WordPress 6.8+, PHP 7.4+. Namespace `ModalKit\`, function and option prefix `modal_kit_`, post type `mk_modal`.
- Build, lint and test with `@wordpress/scripts`. Vitest for JS (not Jest), PHPUnit, Playwright with axe.
- Local sites run on **Laragon**, not Docker. wp-env is for CI only.
- Security: check capabilities, verify nonces, sanitise input, escape output, validate meta and settings against JSON schema. Make every user-facing string translatable.
- Screenshot comparisons run locally only, because the baselines are taken on Windows and GitHub runs Linux. Run `npm run test:e2e` locally before tagging a release.
- Fixed styles must match across themes. After changing `src/styles/` or `src/blocks/modal/style.scss`, run `npm run test:themes`, but never alongside another e2e suite: they share the test site.
- Modal Kit Pro's repo builds against this one's `src/styles/` and `src/admin/settings/components`, and its e2e specs use `tests/e2e/utils/`. Run its checks too when those change.
- Plugin author header: `Sébastien Dumont`.

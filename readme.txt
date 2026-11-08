=== Modal Kit ===
Contributors: sebd86
Tags: modal, popup, slide-in, lightbox, block
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Modals made of blocks: popups, slide-ins, bars, drawers, full-screen takeovers, bottom sheets, inline panels and a video lightbox.

== Description ==

Modal Kit adds one block, Modal, and lets you build everything inside it with the core blocks you already use: Group, Heading, Image, Cover, Buttons. Modals pick up your theme's colors, fonts and spacing from theme.json, and the editor shows the modal over your own homepage, exactly as visitors will see it.

Start from one of the ready-made templates, or from a blank modal, and switch templates later without losing the modal's triggers and display rules.

= Beta =

This is Modal Kit's first public release, labelled beta while it gathers feedback from real sites. Every feature described here is complete and free to use. If something doesn't work as you expect, or you have an idea, please say so in the support forum.

= Nine layouts, one block =

Centered dialog, slide-in corner, top or bottom bar, full-screen takeover, side drawer, split image and content, bottom sheet, inline panel and video lightbox. Each layout has a mobile behaviour built in: split layouts become bottom sheets, corner slide-ins become full-width toasts, bars move to the bottom within thumb reach.

= Six styles =

Native, Soft and Editorial follow your theme's colors, fonts and radius. When a theme's presets are thin, Fieldnote, Harbor and Night bring their own colors, type, spacing and radius, and look the same in any theme. Their accent can follow your theme's primary color or any color you pick (with a warning if it's hard to read), and they can use your theme's fonts instead of their own. Their fonts are bundled with the plugin and load only on pages that show one of these modals.

Pick a style from tiles in the block's Styles tab, previewed as you hover or use the arrow keys. Import, export, duplicate and delete styles in Settings → Styles; an imported style is checked first, and text that may be hard to read is pointed out.

= Opens when you want =

* Any link or button: point it at `#modal-autumn-sale`, or pick the modal in the normal link search.
* Page load with a delay, scroll depth, leaving the page (with a fast-scroll-up fallback on touch devices), time on site, inactivity, a URL query or hash, or a block scrolling into view.

= Polite by default =

* Show on the entire site, only on chosen pages, or everywhere except some. Find pages and posts by title as you type, or use paths such as `/shop/*` for a whole section.
* Once per visit, once every few days, or every time; stop after the visitor clicks a button, or after a set number of times.
* Desktop, tablet and mobile; browsers; a start and end date; wait for the second page view.
* Hide a modal from logged-in users, or from chosen roles, completely: not even a link opens it for them.
* A site-wide limit on automatic modals per page, and a cool-down between them.

Everything a visitor triggers is decided in their browser and remembered in localStorage. No cookies, nothing personal.

= Accessible =

Native `<dialog>` with focus moved to the heading and back to the link, the page behind made inert, Esc and click-outside to close, 44px targets and a reduced-motion fade. Each modal can change the accessible name, the first focus, the close label and more.

= Works on static sites =

Opening, showing and closing a modal never needs a request to WordPress, so sites exported with Simply Static keep working. Modal Kit adds its own script files to Simply Static exports automatically.

= Video =

A video lightbox layout for the Video and Embed blocks: the player loads when the modal opens, pauses when it closes, can autoplay muted, resume, or close when the video ends. YouTube uses youtube-nocookie.com by default, and an optional click-to-load screen means nothing loads from YouTube or Vimeo until the visitor asks. Buttons, Images and Covers can also play a video in a lightbox with no modal at all.

= Modal Kit Pro =

Multi-step modals, form blocks that send to your email service, A/B testing, a style editor, games such as spin to win, results and analytics, age gates, teasers, motion, reviews and carousel blocks, targeting by visitor, referrer, cookie, day, time and country, and template collections (including 27 popup starters) come in Modal Kit Pro, a separate add-on. This plugin contains no Pro code and nothing in it is locked or time-limited. A few places list what Pro adds; one setting hides them all.

== External services ==

Modal Kit itself sends nothing anywhere. A modal only contacts a third-party service when you put that service's content in it:

* **YouTube** — when a modal (or a "Play in video lightbox" link) contains a YouTube video, the player loads from youtube-nocookie.com (or youtube.com if you turn off "Use youtube-nocookie.com"). With the click-to-load screen on (the default), nothing loads until the visitor presses Play. YouTube terms: https://www.youtube.com/t/terms — Google privacy policy: https://policies.google.com/privacy
* **Vimeo** — when a modal (or a link) contains a Vimeo video, the player loads from player.vimeo.com with Do Not Track set, again behind the click-to-load screen by default. Vimeo terms: https://vimeo.com/terms — privacy policy: https://vimeo.com/privacy

Embeds you add with the Embed block also use WordPress's own oEmbed lookups, as they do anywhere else on your site.

== Source code ==

The JavaScript and CSS in `build/` are compiled from the source in `src/`, which comes with the plugin along with its build configuration. To rebuild them, run `npm install` and then `npm run build` in the plugin's folder, using Node 22 or later.

== Credits ==

The Fieldnote, Harbor and Night styles use Instrument Sans and Instrument Serif (Copyright 2022 The Instrument Sans and Instrument Serif Project Authors) and IBM Plex Mono (Copyright 2017 IBM Corp.), all under the SIL Open Font License 1.1. The fonts and their licences are in `assets/fonts`; they are served from your site, never from a font service.

== Installation ==

1. Install Modal Kit from Plugins → Add New, or upload the zip.
2. Activate it. A short setup (two minutes, four steps) picks a starting look and polite defaults, then opens your first modal in the editor. You can skip it and run it again later from Modal Kit → Settings → Tools.
3. Add a modal from Modal Kit → Add New Modal, choose a starter, and publish. Link to it from any button with its address, shown in the Triggers panel.

== Frequently Asked Questions ==

= Does it work with my theme? =

Yes. Modals use your theme's color palette, font sizes, spacing and button radius from theme.json, so they look native in block themes such as Twenty Twenty-Five or Ollie. Classic themes work too.

= Will it slow my site down? =

The front-end script only loads on pages that print a modal, and each trigger type is a small file loaded only when a modal uses it.

= Does it set cookies? =

No. What a visitor has seen is remembered in their browser's localStorage, under keys starting with `modal-kit:`, and never leaves it.

= Can I use forms in a modal? =

You can put any block in a modal, including a form block from a forms plugin. Modal Kit Pro adds its own form blocks that send to email services.

= Does it work after a static export? =

Yes: links, triggers, rules and the video lightbox all run in the browser. Page targeting is decided when each page is exported.

= Who can create modals? =

Authors and Contributors can draft a modal. Editors and Administrators publish it, because a live modal can show on every page of the site. Developers can change this with the `modal_kit_post_type_capabilities` filter.

= Does it work on a multisite network? =

Yes. Network activate it or activate it site by site. Each site has its own modals, settings and styles, and only its own administrators and editors can manage them.

= Does a modal seen on one site count on another site in the network? =

No. Sites in subfolders of one domain share a browser's storage, so each site remembers its visitors under its own path. A modal seen on `/site2/` can still show on `/site3/`, and Reset "already seen" only resets the site you're on. Sites on their own domains or subdomains are separate anyway.

= Can a site administrator on a network add scripts to a modal? =

No. On a network, WordPress only lets Super Admins save unfiltered HTML, so a script in a Custom HTML block is removed when a site administrator saves the modal. Everything else works as normal.

= What happens when I delete it from a network? =

Each site follows its own "Delete all modals and settings when the plugin is deleted" switch under Settings → Tools, so one site can remove its data while another keeps it. Deactivating never removes anything.

= Do schedule and device rules keep a modal secret? =

No. Dates, devices, browsers and frequency are checked in the visitor's browser, which is what lets a static site use them, so a modal that targets the page is already in its HTML. A discount code in a modal scheduled for next week can be found today. To keep a modal off a page, turn it off, use page targeting, or hide it from logged-in users or roles.

= How do I test frequency rules? =

Settings → Tools → Reset "already seen" for my browser, or add `?modal=preview` to a page to see every modal regardless of rules (editors only).

== Screenshots ==

1. A native centered modal, on desktop and as it looks on a phone.
2. The layouts: centered, split, corner, bar, drawer, full-screen, bottom sheet and video lightbox.
3. Building a modal in the editor, shown over your own homepage.
4. Triggers and display rules in the Modal sidebar: search pages by title as you type.
5. Choosing a starting layout.
6. The modal list with layouts, triggers and an on/off switch.
7. Settings: links, frequency, display defaults with a live preview, accessibility.
8. The video lightbox, with the click-to-load screen on a phone.
9. The first-run setup.

== Changelog ==

= 0.1.0 =
* First release (beta).

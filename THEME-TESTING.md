# Testing Modal Kit with your theme

Use this to check how Modal Kit looks in a theme you've built or plan to use. It takes about five minutes and gives you a side-by-side report of screenshots and the exact CSS values that differ.

## What gets checked

Modal Kit has two kinds of style, and each one is held to a different standard:

| Style | What it should do | What the test checks |
|---|---|---|
| **Fieldnote, Harbor and Night** (fixed styles) | Look the same in every theme | Each layout at desktop and phone width, compared with Twenty Twenty-Five by screenshot and by computed CSS |
| **Theme-native** (the default) | Follow your theme | That it stays usable: focus moves to the heading, the close button and buttons are at least 44px tall, the panel fits on screen, and Escape closes it |

A difference in Theme-native colours or fonts is correct, so the test doesn't flag it.

The fixed styles are tested with these blocks: headings, paragraphs, links, buttons, lists, quotes, separators, tables, details, search and inline code.

## Before you start

You need:

- **Node 22.22+ or 24.15+** and a **copy of this repository**.
- **A local WordPress site you don't mind changing**, running WordPress 6.8 or later, with an administrator account.
- **Your theme** in that site's `wp-content/themes` folder, and **Twenty Twenty-Five**, which is the reference.
- **Modal Kit active**, running from your copy of this repository so that the plugin and the tests match. Link or copy the repository to `wp-content/plugins/modal-kit`.

> **Don't use a live site.** During the run the site switches themes and publishes 28 temporary modals, so visitors would see both. Modals that are already on the site can also open during the test and spoil the screenshots, so use a site without any.

## Set up

In the repository folder:

```
npm install
npx playwright install chromium
npm run build
```

Create a file named `.env` in the same folder:

```
WP_BASE_URL=http://localhost:8080
WP_USERNAME=admin
WP_PASSWORD=password
```

Change these to your site's address and administrator login. This file is ignored by Git.

## Run the test

Use your theme's folder name:

```
npm run test:themes -- my-theme
```

To test several themes, list them with spaces between:

```
npm run test:themes -- my-theme my-child-theme
```

The run has two stages: it first captures the reference in Twenty Twenty-Five, then compares your theme with it. When it ends, your original theme is active again and the temporary modals are gone. If you stop a run partway, reactivate your theme yourself. The next run clears any leftover modals.

Run only one test at a time on a site. Two runs switch themes and change modals underneath each other, which causes false failures.

## Read the report

Open `artifacts/themes/index.html` in a browser.

- **The top table** shows each screenshot beside the reference, with differences marked in red. Tick **Only show rows with a difference** to hide the rest.
- **The section for your theme** lists each CSS value that differs, for example `quote padding-left | 16px | 30px`: the element and property, the reference value, then your theme's value.

The command prints a summary line and exits with an error code if anything differs, so you can use it in your own scripts. A test that fails is retried once, because the browser occasionally draws part of a panel a pixel off. A real difference fails both times.

## Fix what it finds

Usually one rule in your theme causes many of the differences, so start with the first property listed.

1. In the browser's developer tools, inspect that element and find the rule that sets the property.
2. Make the rule more specific so it doesn't reach into modals. `.entry-content ul` is safer than `ul`, and `dialog` elements need no global styling.
3. Run the test again. You can skip the reference stage to save time:

   ```
   npm run test:themes -- my-theme --reuse-reference
   ```

   Only skip it if the plugin hasn't changed since the last run.

If your theme's rule looks reasonable and Modal Kit still picks it up, that's a bug in Modal Kit. Please [open an issue](https://github.com/seb86/modal-kit-plugin/issues) with the property list from the report, your theme's name and a link to it if it's public.

## What isn't a problem

- **Inline modals sit in your theme's content column.** The test pins their width so it can compare everything else, so it doesn't report how wide your column is.
- **"Theme fonts" isn't tested.** This setting deliberately uses your theme's fonts, so those modals won't match the fixed style's fonts.
- **A block's own settings win.** Colours, sizes and spacing chosen on a block always override the style, and those aren't compared here.
- **Screenshots aren't compared between computers.** The reference is made fresh on your machine, so differences in font rendering between systems don't count against your theme.

## Useful options

| Command | What it does |
|---|---|
| `npm run test:themes -- my-theme --reuse-reference` | Keep the last reference screenshots |
| `npm run test:themes -- my-theme --reference=twentytwentyfour` | Compare with another theme |
| `npm run test:themes -- my-theme --grep=fieldnote` | Run only the matching tests, here Fieldnote |
| `npm run test:themes -- my-theme --headed` | Show the browser while it runs |

Other Playwright flags work the same way.

## Common problems

| Message | What to do |
|---|---|
| `The theme "my-theme" is not installed` | Use the theme's folder name, and check that it's in `wp-content/themes`. |
| `Set WP_BASE_URL to your test site` | Create the `.env` file described above. |
| Login or `403` errors | Check `WP_USERNAME` and `WP_PASSWORD`. Security plugins can also block the login. |
| `The modal did not open` | Check that Modal Kit is active and no other test is running on the site, then run the test again. If it keeps failing, look for failed requests in the browser console with `--headed`. |
| Every screenshot differs | Check that Twenty Twenty-Five has no customised global styles, or that another plugin isn't adding CSS. |

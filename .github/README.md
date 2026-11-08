# Modal Kit

Modals made of blocks: a WordPress plugin with one block, `modal-kit/modal`, built from core blocks. This is the free plugin, published on WordPress.org as `modal-kit`. The add-on lives in [modal-kit-pro-plugin](https://github.com/seb86/modal-kit-pro-plugin).

## Set up

You need Node 22, Composer and [Laragon](https://laragon.org/) with the dev site (`http://localhost:8081`) and the test site (`http://localhost:8082`).

```
cp .env.example .env     # then adjust the Laragon paths
npm install
composer install
npm run build
npm run env:start        # link the plugin into both sites and activate it
```

## Development

| Command | What it does |
|---|---|
| `npm run start` | Rebuild when files change |
| `npm run build` | Build once (styles first, then `build/`) |
| `npm run lint` | ESLint, Stylelint and PHPCS |
| `npm run lint:phpstan` | PHPStan |
| `npm run format` | Format JS with `wp-scripts format` |
| `npm run env:wp -- <args>` | WP-CLI on the dev site (`--tests` first for the test site) |
| `npm run demos` | A demo page for every modal on the dev site |
| `npm run i18n:pot` | Update `languages/modal-kit.pot` |

## Testing

| Command | What it runs |
|---|---|
| `npm run test:js` | Vitest (`src/`, `tests/js/`) |
| `npm run test:php` | PHPUnit, using the WordPress test library in `WP_TESTS_DIR` |
| `npm run test:unit` | Both of the above |
| `npm run test:e2e` | Playwright and axe on the test site, including the screenshot comparisons, which run locally only |
| `npm run test:static` | Exports the test site with Simply Static and runs `tests/static` against the output |
| `npm run test:themes` | Compares the fixed styles across free themes and writes a report to `artifacts/themes/`. See [THEME-TESTING.md](../THEME-TESTING.md) |

## Release

1. Set the version in `modal-kit.php`, `package.json` and `readme.txt` (`Stable tag`), and update the changelog in `readme.txt`.
2. Run `npm run test:e2e` locally. GitHub skips the screenshot comparisons, so this is the only check of them.
3. Push a tag: `git tag v1.0.0 && git push origin v1.0.0`. A tag with a hyphen, such as `v1.0.0-beta.1`, makes a pre-release.

`npm run plugin-zip` builds the same zip locally, as `releases/modal-kit-<version>.zip`, using the version in `modal-kit.php`. It holds only the paths under `files` in `package.json`, which include `src/`, because WordPress.org requires the source of compiled code. Build and development files, such as `package.json` and `webpack.config.js`, stay out. Earlier versions stay in `releases/`, which Git ignores.

`.wordpress-org/` holds the WordPress.org banners, icons, screenshots and Live Preview blueprint, which never go in the zip. `npm run wporg:screenshots` and `npm run wporg:blueprint` rebuild them.

## GitHub workflows

| Workflow | Runs on | What it does |
|---|---|---|
| `development.yml` | Part of a release, or by hand | Lint, PHPStan, Vitest and build |
| `testing.yml` | Part of a release, or by hand | PHPUnit (PHP 7.4 to 8.5, two WordPress versions), Playwright, static export and Plugin Check |
| `release.yml` | `v*` tags | Checks the tag matches the version, runs the two above, then builds the zip and publishes a GitHub release |

Only a `v*` tag runs these automatically, to save Actions minutes. Pushes and pull requests don't run anything, so run the checks locally as you work. To try the suites on GitHub before tagging, start **Development** or **Testing** by hand from the Actions tab; that publishes nothing.

A tag runs the stages in order, each waiting for the one before: version check, Development, Testing, publish. If any stage fails, nothing is published. Fix the problem, delete the tag and push it again. Screenshots aren't part of this: they're compared only when `test:e2e` runs locally.

To deploy stable tags to WordPress.org too, set the repository variable `WPORG_DEPLOY` to `true` and add the secrets `SVN_USERNAME` and `SVN_PASSWORD`.

## License

GPL-2.0-or-later. Author: Sébastien Dumont.

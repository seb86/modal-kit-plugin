# Developing Modal Kit

For what the plugin is and how to use it, see [README.md](README.md).

## Setup

You need Node 22.22+ or 24.15+, Composer, and two local WordPress sites. The tooling expects [Laragon](https://laragon.org/) on Windows.

```
cp .env.example .env     # then set your paths and site addresses
npm install
composer install
npm run env:start        # link the plugin into the local sites, activate it, check they respond
npm run start            # build and watch
```

The compiled files in `build/` come from `src/`. Build them once with `npm run build`.

## Commands

| Command | What it does |
|---|---|
| `npm run env:start` | Link the plugin into the local sites and activate it |
| `npm run env:wp -- <cmd>` | Run WP-CLI on the dev site (add `--tests` for the test site) |
| `npm run build` | Compile the plugin |
| `npm run start` | Compile and watch |
| `npm run lint` | JavaScript, styles and PHP |
| `npm run test:unit` | Vitest and PHPUnit |
| `npm run test:multisite` | PHPUnit with WordPress running as a network |
| `npm run test:e2e` | Playwright, including axe checks and screenshot comparisons |
| `npm run test:browsers` | The front-end specs on Firefox, WebKit and two emulated phones (install them once with `npx playwright install firefox webkit`) |
| `npm run test:static` | Export with Simply Static, then run e2e against the output |
| `npm run test:themes` | Compare the fixed styles across free themes, and write a report to `artifacts/themes/` |

## Releasing

`package.json` holds the version and requirements (`requires`, `requires_php`, `tested_up_to`). These commands copy them everywhere else:

| Command | What it does |
|---|---|
| `npm version 1.2.3` | Set the version in `package.json`, then update the plugin header and constant, `block.json`, the `.pot` and the lockfile. It creates no commit or tag. |
| `npm run version` | Do the same copy after you edit `package.json` by hand |
| `npm run stable` | Set the readme's `Stable tag`, and nothing else. It refuses a pre-release. |
| `npm run zip` | `version`, build, regenerate the `.pot` and write the zip, leaving `Stable tag` alone |
| `npm run ready` | The same as `zip`, plus `stable`. Use this for what goes to WordPress.org. |

Zips are written to `releases/`.

`Stable tag` is separate because it decides what WordPress.org gives people. It takes numbers and periods only, so a version like `1.2.3-beta.1` can't be one, and Plugin Check reports a mismatch on a `zip` build whose version is ahead of it.

To release:

1. Run `npm version 1.2.3` and add the entry to the changelog in `readme.txt`.
2. Run the checks below, then `npm run ready`.
3. Commit, then push the tag `v1.2.3`.

## Checks

Only a `v*` tag runs the GitHub workflows, to save Actions minutes: `development.yml` and `testing.yml` run first, and `release.yml` publishes nothing if a stage fails. Pushes and pull requests run nothing, so run `npm run lint` and `npm run test:unit` before finishing a change.

Screenshot comparisons run locally only, so also run `npm run test:e2e` before tagging, and `npm run test:browsers` when the runtime or the modal's styles change. Emulated phones aren't real ones: check a release on an actual iPhone, and with a screen reader.

`npm run test:themes` takes about 25 minutes, so run it when `src/styles/` or `src/blocks/modal/style.scss` changes, and before tagging. It compares the themes in `tests/themes/themes.json` with Twenty Twenty-Five, and [THEME-TESTING.md](THEME-TESTING.md) explains the report. It uses the test site, so don't run it alongside `test:e2e`, in this repo or in Pro. Each suite switches themes and deletes modals, which makes the other fail.

A tag with a hyphen, such as `v1.2.3-beta.1`, publishes a GitHub pre-release and never deploys to WordPress.org.

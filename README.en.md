# MakeMarkdown

[日本語](README.md)

A browser extension that converts the page you are reading into Markdown, shows it
in a reader-style view, and lets you download it as a `.md` file. It works in both
Firefox and Chrome (Manifest V3).

## Usage

1. Click the MakeMarkdown toolbar button on the page you want to convert (or press `Alt+Shift+M`)
2. A viewer opens in a new tab with the converted result
3. Switch between "Preview / Markdown" and save the `.md` file with "Download"

- If text is **selected** on the page, only the selection is converted.
- "Display settings" in the viewer changes the theme (auto/light/sepia/dark), typeface,
  font size, content width, and what goes into the output (title heading, source link,
  front matter).
- `Ctrl/Cmd + S` also downloads the file.
- The interface follows the browser language, in Japanese or English (Japanese by default).

## Pages whose content is cut off by JavaScript

Some sites render the article and then let JavaScript remove or collapse part of it.
MakeMarkdown builds Markdown from each of the states below and uses **whichever has the
most content** (the badge at the top left of the viewer shows which one was used).

| Source | What it is |
| --- | --- |
| Current DOM | The DOM at the moment the button was pressed |
| Current DOM (after it settled) | The DOM after waiting for changes to stop |
| Recorded state with the most content | The state remembered while watching from the moment the page opened (opt-in) |
| Original HTML from the server | The HTML as it was before JavaScript ran (opt-in) |

Elements hidden with `display:none` and the like are also kept when they hold enough
text and few links — this rescues article bodies folded behind a "read more" control.

"Record the moment the page had the most content" and "Also fetch the original HTML"
are enabled from the extension's options page. The former needs permission to read all
sites, so it is off by default.

## Building the packages

```
sh tools/build.sh            # both
sh tools/build.sh firefox
sh tools/build.sh chrome
```

The shared source is combined with a per-browser manifest and written to `dist/`.

- `dist/<target>/` — for loading unpacked
- `dist/makemarkdown-<version>-<target>.zip` — for uploading to the stores

| | Firefox | Chrome |
| --- | --- | --- |
| manifest | `manifest.json` | `manifest.chrome.json` |
| background | `background.scripts` (event page) | `background.service_worker` |
| supported versions | Firefox 140+ / Android 142+ | Chrome 102+ |

Chrome has no `browser` namespace, so `src/i18n.js` and `background.js` assign `chrome`
to it at the top of the file.

## Installing (development)

Firefox:

```
about:debugging#/runtime/this-firefox → "Load Temporary Add-on" → manifest.json
```

Chrome:

```
sh tools/build.sh chrome
chrome://extensions → "Developer mode" → "Load unpacked" → dist/chrome
```

> **Do not load the repository root in Chrome.** The `manifest.json` there is the Firefox
> one and uses `background.scripts`. Chrome treats that as a warning, so the extension
> still loads — but **the background never runs and clicking the toolbar button does
> nothing** (`'background.scripts' requires manifest version of 2 or lower.`).
> Always load `dist/chrome` in Chrome.

With `web-ext`:

```
npx web-ext run                            # launch a development Firefox
npx web-ext lint --source-dir dist/firefox # validate the package contents
```

## Store submission

- Firefox Add-ons: `FIREFOX_SUBMISSION.md` (in Japanese; the listing copy is in both languages)
- Chrome Web Store: `STORE_SUBMISSION.md` (same)

Screenshots and promotional images for the listings are in `screenshots/`. To rebuild them:

```
node tools/make-screenshots.mjs
```

This re-renders the viewer and the options page with a sample article in headless Chrome.

## Layout

| File | Role |
| --- | --- |
| `manifest.json` | Extension definition (MV3, for Firefox) |
| `manifest.chrome.json` | Extension definition (MV3, for Chrome) |
| `_locales/ja` / `_locales/en` | Interface strings (Japanese by default) |
| `src/i18n.js` | Message replacement for the extension pages |
| `tools/build.sh` | Builds the per-browser zip and unpacked directory |
| `tools/make-screenshots.mjs` | Builds the store screenshots |
| `background.js` | Runs the conversion, hands over the result, registers the recorder |
| `src/recorder.js` | Records the moment the page had the most content (runs at document_start) |
| `src/readability-lite.js` | Finds the article element and reads the metadata |
| `src/html-to-markdown.js` | DOM to Markdown conversion |
| `src/extract.js` | Compares the states and returns the longest Markdown |
| `src/markdown-to-html.js` | Renders the viewer preview (the generator limits the HTML) |
| `viewer.html` / `viewer.css` / `viewer.js` | Viewer screen |
| `options.html` / `options.css` / `options.js` | Options screen |
| `icons/` | Icons (`icon.svg` is the source; the PNGs are exported from it) |
| `screenshots/` | Images for the store listings |
| `privacy-policy.html` | Privacy policy (to publish at a URL) |
| `PRIVACY_POLICY.md` | Privacy policy (to paste into the AMO field) |
| `FIREFOX_SUBMISSION.md` / `STORE_SUBMISSION.md` | Store submission input and checklists |
| `LICENSE` | MIT license |
| `README.md` / `README.en.md` | This document (Japanese / English) |

## Permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Read the page in the tab whose button was pressed |
| `scripting` | Run the conversion scripts, register the recorder script |
| `storage` | Store the settings and the conversion results (for the session only) |
| `*://*/*` (optional) | Only when "Record the moment the page had the most content" is used |

Nothing is sent anywhere. Page content is kept inside the browser (`storage.session`)
and is discarded when the browser closes.
See the [privacy policy](PRIVACY_POLICY.md) for details.

## License

MIT License (see `LICENSE`).

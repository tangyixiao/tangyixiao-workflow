# tangyixiao-workflow project website
[简体中文](https://tangyixiao.github.io/tangyixiao-workflow/) · [English](https://tangyixiao.github.io/tangyixiao-workflow/en/)

The published site uses GitHub Pages. Changes to the site on `main` are checked before deployment. For offline use, open the [local Chinese](site/index.html) or [local English](site/en/index.html) homepage.

Open either HTML file in a browser, or run the following from `project-website/`:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory site
```

Visit <http://127.0.0.1:8765/>. Change `project.json` for identity and destinations,
and edit `locales/zh-CN.json` and `locales/en.json` together for visitor copy.

```sh
python3 scripts/render_site.py
python3 scripts/check.py
```

Both homepages include an editable release-note workbench. Checks run in the
browser. Copying a task prepares text to paste into a separate Codex session.
The site offers the redacted PowerShell recording in [landscape](site/media/terminal-session.mp4),
[portrait](site/media/terminal-session-vertical.mp4) and a [short edit](site/media/terminal-session-short.mp4).
The full recording includes the command, the model reply and the separate test run.
The short edit skips waiting time. The media files are requested on demand.
The site check verifies the filenames and SHA-256 hashes of these approved
exports, with an 8 MiB combined media budget. Review the recording for private
terminal suggestions before updating the corresponding hash for a replacement.

The eight pages remain readable without JavaScript. JavaScript runs draft checks,
adds the mobile menu and remembers the appearance choice. The renderer derives
the browser rule implementation from the repository's `lib/notes.mjs`.
CI also tests keyboard navigation, all
eight routes, theme selection and responsive layout using Chrome and ChromeDriver.
See `NOTICE` and `LICENSE.template` for the template provenance.

## Review a visual change

Use the [site design brief](DESIGN.md) to identify the visitor's task and the
specific change to assess in each capture.

From `project-website/`, use Chrome or Chromium with a matching ChromeDriver on
your PATH and a font that includes Chinese characters. Capture the current site
before editing it.

```sh
python3 scripts/smoke_browser.py . --screenshots ../work/website-review --round before
```

In `../work/website-review/before/`, open `390-home-zh.png` beside
`390-home-en.png`, then repeat at 768 and 1440 px. Each pair uses the same
browser session and theme. The viewports are 390 × 844, 768 × 900 and
1440 × 900 CSS pixels.

Read each headline and find the main action in its own language. Check where
Chinese phrases break across lines, how much space English labels take in the
navigation, and whether each layout gives the main action enough room. Record
the filename and the visible issue. Three more images show the English features
page in dark mode, the open Chinese mobile menu and the English download page.

After the edit, render the site and capture the same views.

```sh
python3 scripts/render_site.py
python3 scripts/check.py
python3 scripts/smoke_browser.py . --screenshots ../work/website-review --round after
```

Check that the browser command reports `"ok": true`. Open matching files in
`before/` and `after/` side by side. Compare heading wraps, navigation, button
placement and the state affected by the edit in each language. A repeated capture
replaces the nine files for that round. For changes outside these views, open the affected
page or control and capture that state at the same width in both rounds.

On a successful **Validate the bilingual project website** run, download
`website-screenshots` from the run summary. It contains the nine `after/` images
for that revision and is retained for three days.

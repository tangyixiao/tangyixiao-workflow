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

The eight committed HTML pages work without JavaScript. JavaScript adds the mobile
menu and remembers the appearance choice. CI also tests keyboard navigation, all
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

Open the three `*-home-zh.png` files in `../work/website-review/before/`.
They show the same Chinese homepage at 1440 × 900, 768 × 900 and 390 × 844 CSS
pixels. The other three images show the English features page in dark mode,
the open mobile menu and the English download page reached through that menu.
Record the filename and the visible issue, such as a Chinese heading wrapping
over a button at 390 px.

After the edit, render the site and capture the same views.

```sh
python3 scripts/render_site.py
python3 scripts/check.py
python3 scripts/smoke_browser.py . --screenshots ../work/website-review --round after
```

Check that the browser command reports `"ok": true`. Open matching files in
`before/` and `after/` side by side. Compare heading wraps, navigation, button
placement and the state affected by the edit. A repeated capture replaces the
six files for that round. For changes outside these views, open the affected
page or control and capture that state at the same width in both rounds.

On a successful **Validate the bilingual project website** run, download
`website-screenshots` from the run summary. It contains the six `after/` images
for that revision and is retained for three days.

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

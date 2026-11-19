"""Check the bilingual project homepage in Chrome through the W3C WebDriver API.

Requires Chrome/Chromium and chromedriver on PATH. Uses only the Python stdlib.
"""
import argparse
import base64
import contextlib
import functools
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

HTTP = build_opener(ProxyHandler({}))
PAGES = ("index.html", "features.html", "download.html", "community.html")
ELEMENT = "element-6066-11e4-a52e-4f735466cecf"
SAMPLE_RULES = {"notes-no-duplicate-title": "false", "notes-no-private-instructions": "false",
                "notes-no-private-machine-state": "true"}


def call(method, url, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = Request(url, data=data, method=method,
                      headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with HTTP.open(request, timeout=20) as response:
            return json.load(response)["value"]
    except HTTPError as exc:
        try:
            reason = json.loads(exc.read())["value"]["message"]
        except (ValueError, KeyError, TypeError):
            reason = str(exc.reason)
        raise RuntimeError(f"{method} {url}: {reason}") from exc


class QuietServer(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            # A media client may cancel a read when it closes the player.
            pass

    def translate_path(self, path):
        # Expose this site's files only, beneath /project/ like a GitHub Pages site.
        if not path.startswith("/project/"):
            return str(Path(self.directory) / "absent-http-route")
        return super().translate_path(path[len("/project"):])


@contextlib.contextmanager
def serve(site):
    handler = functools.partial(QuietServer, directory=site)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .03},
                              daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/project/"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@contextlib.contextmanager
def webdriver(path):
    with socket.socket() as reserved:
        reserved.bind(("127.0.0.1", 0))
        port = reserved.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryFile(mode="w+b") as log:
        proc = subprocess.Popen([path, f"--port={port}"], stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 12
            while time.monotonic() < deadline and proc.poll() is None:
                try:
                    if call("GET", url + "/status")["ready"]:
                        break
                except (URLError, OSError, RuntimeError):
                    pass
                time.sleep(.1)
            else:
                log.seek(0)
                raise RuntimeError("chromedriver did not start: " + log.read(1024).decode(errors="replace"))
            yield url
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


class Chrome:
    def __init__(self, endpoint):
        self.endpoint = endpoint

    def cmd(self, method, suffix, payload=None):
        return call(method, self.endpoint + suffix, payload)

    def js(self, script, *args):
        return self.cmd("POST", "/execute/sync", {"script": script, "args": args})

    def find(self, selector):
        return self.cmd("POST", "/element", {"using": "css selector", "value": selector})[ELEMENT]

    def click(self, selector):
        self.cmd("POST", "/element/" + self.find(selector) + "/click", {})

    def replace_text(self, selector, value):
        element = "/element/" + self.find(selector)
        self.cmd("POST", element + "/clear", {})
        if value:
            self.cmd("POST", element + "/value", {"text": value})

    def key(self, key):
        self.cmd("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
            {"type": "keyDown", "value": key}, {"type": "keyUp", "value": key}]}]})

    def goto(self, url):
        self.cmd("POST", "/url", {"url": url})

    def wait(self, predicate, message, timeout=3):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(.05)
        raise ValueError(message)

    def expect_url(self, url):
        self.wait(lambda: self.cmd("GET", "/url") == url, f"expected navigation to {url}")

    def capture(self, directory, name):
        if directory:
            width, height = self.js("""
                const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
                return document.fonts.ready.then(nextFrame).then(() => [innerWidth, innerHeight]);
            """)
            data = base64.b64decode(self.cmd("GET", "/screenshot"), validate=True)
            require(data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24
                    and data[12:16] == b"IHDR" and struct.unpack(">II", data[16:24]) == (width, height),
                    f"{name}: expected a {width}x{height} viewport PNG")
            directory.mkdir(parents=True, exist_ok=True)
            (directory / f"{width}-{name}.png").write_bytes(data)


@contextlib.contextmanager
def session(driver, binary, width, height, js=True):
    # User-data, preferences and all browser state belong only to this session.
    with tempfile.TemporaryDirectory(prefix="project-website-chrome-") as profile:
        opts = {"args": ["--headless=new", "--disable-dev-shm-usage", "--disable-background-networking",
                         "--no-first-run", f"--user-data-dir={profile}"]}
        if getattr(os, "geteuid", lambda: None)() == 0:
            opts["args"].append("--no-sandbox")
        if binary:
            opts["binary"] = binary
        if not js:
            opts["prefs"] = {"profile.managed_default_content_settings.javascript": 2}
        caps = {"browserName": "chrome", "goog:chromeOptions": opts,
                "goog:loggingPrefs": {"browser": "ALL"}}
        sid = call("POST", driver + "/session", {"capabilities": {"alwaysMatch": caps}})["sessionId"]
        chrome = Chrome(driver + "/session/" + sid)
        try:
            chrome.cmd("POST", "/window/rect", {"width": width, "height": height})
            # Use CSS viewport dimensions on every host, including HiDPI desktops.
            chrome.cmd("POST", "/goog/cdp/execute", {"cmd": "Emulation.setDeviceMetricsOverride",
                "params": {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 500}})
            yield chrome
        finally:
            chrome.cmd("DELETE", "")


def require(ok, message):
    if not ok:
        raise ValueError(message)


def check_pages(browser, base, width, shots=None):
    home_mode = None
    for locale in ("", "en/"):
        for filename in PAGES:
            browser.goto(base + locale + filename)
            state = browser.js("""
              const h = document.querySelector('main h1');
              return {heading:h && h.innerText.trim(), width:innerWidth,
                      scroll:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
                      lang:document.documentElement.lang, mode:document.documentElement.dataset.colorMode,
                      missing:[...document.images].filter(i => i.loading !== "lazy" && i.getClientRects().length && (!i.complete || !i.naturalWidth)).length};
            """)
            require(state["heading"] and state["lang"] == ("en" if locale else "zh-CN"),
                    f"{locale}{filename}: missing translated content")
            require(state["width"] == width and state["scroll"] <= width + 1,
                    f"{locale}{filename}: viewport/overflow {state}")
            require(not state["missing"], f"{locale}{filename}: unloaded image")
            if shots is not None and filename == "index.html":
                mode = state["mode"]
                require(mode in ("light", "dark") and (home_mode is None or mode == home_mode),
                        f"{width}px: homepage screenshots need the same theme ({home_mode}, {mode})")
                home_mode = mode
                browser.capture(shots, "home-en" if locale else "home-zh")


def language(browser, code):
    browser.click(".language-picker summary")
    browser.click(f'.language-picker a[hreflang="{code}"]')


def draft_state(browser):
    return browser.js("""
        const el = s => document.querySelector(s);
        const visible = node => node.getClientRects().length > 0 && node.innerText.trim();
        const rows = [...document.querySelectorAll('#rules li')].filter(visible);
        return {lang:document.documentElement.lang, title:el('#release-title').value,
                body:el('#notes').value, count:visible(el('#count')) || '',
                pending:el('#pending').getClientRects().length > 0,
                rules:Object.fromEntries(rows.map(row => [row.dataset.rule, row.dataset.ok]))};
    """)


def check_workbench(browser, base, first, second):
    homes = {"zh-CN": base + "index.html", "en": base + "en/index.html"}
    browser.goto(homes[first])
    seed = draft_state(browser)
    require(seed["lang"] == first and seed["rules"] == SAMPLE_RULES and "2" in seed["count"],
            f"{first}: initial sample report: {seed}")
    language(browser, second)
    browser.expect_url(homes[second])
    translated = draft_state(browser)
    require(translated["lang"] == second and translated["rules"] == SAMPLE_RULES
            and translated["title"] != seed["title"] and translated["body"] != seed["body"]
            and translated["count"] != seed["count"] and "2" in translated["count"],
            f"{second}: expected localized sample and findings")

    title = "CSV Tools v1.2"
    body = "CSV export now quotes fields containing commas."
    browser.replace_text("#release-title", title)
    browser.replace_text("#notes", body)
    dirty = draft_state(browser)
    require(dirty["pending"] and not dirty["rules"] and dirty["count"] != translated["count"],
            f"{second}: the changed text still shows the previous report")
    language(browser, first)
    browser.expect_url(homes[first])
    edited = draft_state(browser)
    require(edited["title"] == title and edited["body"] == body and edited["pending"]
            and not edited["rules"] and edited["count"] != seed["count"],
            f"{first}: edits or pending state lost on language change")
    browser.click("#run")
    checked = draft_state(browser)
    all_pass = dict.fromkeys(SAMPLE_RULES, "true")
    require(checked["rules"] == all_pass and not checked["pending"] and "3" in checked["count"],
            f"{first}: explicit recheck did not clear both sample findings")
    language(browser, second)
    browser.expect_url(homes[second])
    checked_again = draft_state(browser)
    require(checked_again["title"] == title and checked_again["body"] == body
            and checked_again["rules"] == all_pass and checked_again["count"] != checked["count"],
            f"{second}: missing checked draft or translation after navigation")

    private_line = "As requested by the user, this version quotes CSV fields."
    browser.replace_text("#notes", private_line)
    # Reproduce clipboard denial without writing to the user's clipboard.
    browser.js("""
        Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true});
        document.execCommand = () => false;
    """)
    browser.click("#copy")
    manual = browser.js("""
        const area = document.querySelector('#task-text');
        return {visible:area.getClientRects().length > 0, value:area.value,
                selected:document.activeElement === area && area.selectionStart === 0
                         && area.selectionEnd === area.value.length,
                status:document.querySelector('#copy-status').innerText.trim()};
    """)
    require(manual["visible"] and manual["selected"] and manual["status"]
            and all(item in manual["value"] for item in
                    (title, private_line, "notes-no-private-instructions", "$tangyixiao-workflow"))
            and "notes-no-duplicate-title" not in manual["value"],
            f"{second}: manual copy must include the current draft and its actual finding")
    browser.replace_text("#release-title", "")
    browser.click("#run")
    require(browser.js("""return document.activeElement.id === 'release-title' &&
        document.querySelector('#release-title').getAttribute('aria-invalid') === 'true' &&
        document.querySelector('#field-error').getClientRects().length > 0 &&
        !document.querySelector('#rules li')"""), f"{second}: missing title validation")


def check_recording(browser, base):
    require(browser.js("""return !document.querySelector('#terminal-video').currentSrc &&
        !document.querySelector('#terminal-video').getAttribute('src')"""),
        "recording should load only when opened")
    browser.click("[data-video]")
    expected = base + "media/terminal-session.mp4"
    require(browser.js("""
        const dialog = document.querySelector('#player'), rect = dialog.getBoundingClientRect();
        const link = dialog.querySelector('a[download]');
        return dialog.open && rect.left >= -1 && rect.right <= innerWidth + 1 &&
               link && link.href === arguments[0] && link.getClientRects().length > 0 &&
               link.innerText.trim() && document.querySelector('#terminal-video').src === arguments[0];
    """, expected), "recording dialog, source, or download link failed")
    browser.wait(lambda: browser.js("""
        const v = document.querySelector('#terminal-video');
        return Boolean(v.error) || (v.videoWidth > 0 && v.videoHeight > 0 &&
               Number.isFinite(v.duration) && v.duration > 0 && !v.paused && v.currentTime > 0);
    """), "recording did not load metadata and advance playback", timeout=10)
    error = browser.js("""const v = document.querySelector('#terminal-video');
        return v.error && {code:v.error.code, supported:v.canPlayType('video/mp4; codecs="avc1.64002A"'),
          hint:document.querySelector('#media-error').getClientRects().length > 0};""")
    outcome = "recording-metadata-and-playback"
    if error:
        require(error["code"] == 4 and not error["supported"] and error["hint"],
                f"unexpected recording failure: {error}")
        # The local download must work even on a build without the H.264 codec.
        with HTTP.open(Request(expected, method="HEAD"), timeout=3) as response:
            require(response.status == 200 and int(response.headers["Content-Length"]) > 0,
                    "missing recording download")
        outcome = "recording-download-only-no-h264"
    browser.click("#player button")
    browser.wait(lambda: browser.js("""return !document.querySelector('#player').open &&
        document.querySelector('#terminal-video').paused"""), "closing the recording must stop playback")
    return outcome


def log_check(browser):
    errors = [m["message"] for m in browser.cmd("POST", "/se/log", {"type": "browser"})
              if m["level"] in {"WARNING", "SEVERE"}]
    require(not errors, "browser warnings/errors: " + " | ".join(errors)[:1200])


def execute(site, driver_path, binary, shots, passed):
    with serve(site) as base, webdriver(driver_path) as driver:
        with session(driver, binary, 1440, 900) as browser:
            check_pages(browser, base, 1440, shots)
            passed.append("desktop-8-pages")
            browser.goto(base + "index.html")
            browser.key("\ue004")  # Tab
            require(browser.js("return document.activeElement.matches('.skip-link')"), "skip link focus")
            browser.key("\ue007")  # Enter
            browser.expect_url(base + "index.html#main")
            browser.click('.main-nav a[href$="features.html"]')
            browser.click(".theme-picker summary")
            browser.click('[data-theme-choice="dark"]')
            language(browser, "en")
            browser.expect_url(base + "en/features.html")
            browser.cmd("POST", "/refresh", {})
            require(browser.js("return document.documentElement.dataset.colorMode") == "dark",
                    "dark theme did not persist across language and reload")
            browser.capture(shots, "features-en-dark")
            for choice in ("system", "light"):
                browser.click(".theme-picker summary")
                browser.click(f'[data-theme-choice="{choice}"]')
                require(browser.js("return document.documentElement.dataset.theme") == choice,
                        f"theme choice {choice}")
            log_check(browser)
            passed.append("desktop-keyboard-locale-themes-console")
            check_workbench(browser, base, "zh-CN", "en")
            passed.append("desktop-bilingual-edits-recheck-manual-copy")
            passed.append("desktop-" + check_recording(browser, base))
            log_check(browser)
        for width, height in ((1280, 850), (768, 900), (320, 750)):
            with session(driver, binary, width, height) as browser:
                check_pages(browser, base, width, shots if width == 768 else None)
                log_check(browser)
                passed.append(f"{width}px-8-pages")
        with session(driver, binary, 390, 844) as browser:
            check_pages(browser, base, 390, shots)
            passed.append("mobile-8-pages")
            browser.goto(base + "index.html")
            browser.click(".menu-toggle")
            require(browser.js("return document.querySelector('.menu-toggle').getAttribute('aria-expanded')") == "true",
                    "mobile menu failed to open")
            browser.capture(shots, "menu-zh-open")
            browser.key("\ue00c")  # Escape
            require(browser.js("return document.activeElement.matches('.menu-toggle') && document.activeElement.getAttribute('aria-expanded') === 'false'"),
                    "Escape failed to close menu or restore focus")
            browser.click(".menu-toggle")
            browser.click('.main-nav a[href$="download.html"]')
            language(browser, "en")
            browser.expect_url(base + "en/download.html")
            browser.capture(shots, "download-en")
            log_check(browser)
            passed.append("mobile-menu-keyboard-locale-console")
            check_workbench(browser, base, "en", "zh-CN")
            passed.append("mobile-bilingual-edits-recheck-manual-copy")
            passed.append("mobile-" + check_recording(browser, base))
            log_check(browser)
        with session(driver, binary, 390, 780, js=False) as browser:
            for locale in ("en/", ""):
                browser.goto(base + locale + "index.html")
                require(not browser.js("return document.documentElement.classList.contains('js')"),
                        "scripts unexpectedly active in the no-JS session")
                require(browser.js("""
                    const cmd = document.querySelector('noscript code'), link = document.querySelector('[data-video]');
                    return cmd && cmd.getClientRects().length && cmd.innerText.includes('notes-check')
                        && link && link.href === arguments[0] && link.getClientRects().length
                        && !document.querySelector('#run').getClientRects().length;
                """, base + "media/terminal-session.mp4"), f"{locale}index.html: no-JS CLI or recording link missing")
            passed.append("no-js-bilingual-cli-and-recording-links")
            browser.click('.main-nav a[href$="community.html"]')
            language(browser, "en")
            browser.expect_url(base + "en/community.html")
            require(browser.js("return document.querySelector('main h1').innerText.trim()"), "no-JS empty page")
            log_check(browser)
            passed.append("no-js-menu-language-and-reading")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    parser.add_argument("--screenshots", type=Path, help="write viewport PNGs under this directory")
    parser.add_argument("--round", choices=("before", "after"), default="after",
                        help="screenshot subdirectory (default: after)")
    parser.add_argument("--chromedriver", default=shutil.which("chromedriver"))
    parser.add_argument("--chrome", default=shutil.which("google-chrome") or shutil.which("chromium"))
    args = parser.parse_args()
    passed = []
    errors = []
    try:
        require(args.chromedriver, "chromedriver not found on PATH")
        site = (args.project / "site").resolve()
        require((site / "index.html").is_file(), "missing site/index.html")
        shots = args.screenshots / args.round if args.screenshots is not None else None
        execute(site, args.chromedriver, args.chrome, shots, passed)
    except (OSError, ValueError, KeyError, RuntimeError) as exc:
        errors.append(str(exc))
    print(json.dumps({"project": args.project.name, "ok": not errors, "checks": passed,
                      "errors": errors}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

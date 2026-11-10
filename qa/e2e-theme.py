"""
Browser checks for the Skin Library (theme selector in the navbar, 8 themes, per-account persistence).

  BOSS_URL=http://localhost:3100 python3 qa/e2e-theme.py

Run it on a fresh database behind the local fake sign-in (sh qa/start-e2e-stack.sh). It changes the test account's theme.
"""
import json, os, re, sys, time, traceback
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BOSS_URL", "http://localhost:3100")
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
EMAIL, PASSWORD = os.environ.get("BOSS_E2E_EMAIL", "admin@example.test"), os.environ.get("BOSS_E2E_PASSWORD", "local-test-password")
THEMES = [("yellow", "Golden Hour"), ("white", "Porcelain"), ("purple", "Amethyst"), ("blue", "Sapphire"), ("midnight", "Midnight")]
DESCRIPTIONS = {"yellow": "Warm yellow, soft cream, and deep navy accents.", "white": "Clean white, soft gray, and ink-black accents.", "purple": "Deep violet, lavender, and balanced neutral tones.", "blue": "Rich blue, cool white, and deep navy accents.", "midnight": "Deep navy, bold red, and bright cyan accents."}
IDS = [t for t, _ in THEMES]
results, console_errors = [], []

CONTRAST_JS = """
(min) => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; };
  const over = (t, b) => { const a = t.a + b.a*(1-t.a); if (a===0) return {r:0,g:0,b:0,a:0}; return {r:(t.r*t.a+b.r*b.a*(1-t.a))/a,g:(t.g*t.a+b.g*b.a*(1-t.a))/a,b:(t.b*t.a+b.b*b.a*(1-t.a))/a,a}; };
  const lum = (c) => { const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
  const ratio = (a,b) => { const [h,l] = [lum(a),lum(b)].sort((x,y)=>y-x); return (h+0.05)/(l+0.05); };
  const base = parse(getComputedStyle(document.body).backgroundColor) || {r:255,g:255,b:255,a:1};
  const bad = []; let checked = 0; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; const t = n.nodeValue.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName) || (el.closest('svg') && !el.closest('text')) || el.closest('[data-testid=voucher-document]')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el); if (cs.visibility==='hidden' || cs.display==='none') continue;
    let op = 1, p = el; while (p) { op *= parseFloat(getComputedStyle(p).opacity); p = p.parentElement; } if (op < 0.5) continue;
    let fg = parse(cs.color); if (!fg) continue;
    const stack = []; let q = el, unknown = false;
    while (q) { const s = getComputedStyle(q); if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.startsWith('url')) { unknown = true; break; } const bg = parse(s.backgroundColor); if (bg && bg.a>0) { stack.push(bg); if (bg.a>=1) break; } q = q.parentElement; }
    if (unknown) continue;
    const solid = stack.length && stack[stack.length-1].a>=1;
    let bg = solid ? stack[stack.length-1] : base;
    for (let i = stack.length - (solid ? 2 : 1); i>=0; i--) bg = over(stack[i], bg);
    fg = over({...fg, a: fg.a*op}, {...bg,a:1}); checked++;
    const c = ratio(fg, bg);
    if (c < min) bad.push(`${Math.round(c*100)/100} ${el.tagName.toLowerCase()}.${String(el.className||'').split(' ')[0]} "${t.slice(0,30)}"`);
  }
  return { checked, bad };
}
"""

def hex_rgb(h):
    h = h.strip().lstrip("#")
    return "rgb(%d, %d, %d)" % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def cleanup():
    for _ in range(5):
        try:
            if page.locator("[role=dialog]").count():
                page.keyboard.press("Escape"); page.wait_for_timeout(300); continue
        except Exception:
            pass
        break

def check(name, fn):
    cleanup()
    try:
        fn(); results.append((True, name)); print("PASS", name)
    except Exception as e:  # noqa: BLE001
        results.append((False, name))
        tb = [f for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e-theme.py")]
        where = f" (line {tb[-1].lineno}: {tb[-1].line[:120]})" if tb else ""
        print("FAIL", name, "->", ((str(e).splitlines() or [repr(e)])[0][:240]) + where)
        try: page.screenshot(path="/tmp/shots/TH-" + "".join(c if c.isalnum() else "_" for c in name)[:60] + ".png")
        except Exception: pass

def go(path, p=None):
    pg = p or page
    pg.goto(BASE + path, wait_until="load"); pg.wait_for_selector("aside[aria-label=Views]"); pg.wait_for_timeout(500)

def theme_attr(p=None): return (p or page).evaluate("document.documentElement.dataset.theme")
def var(name, p=None): return (p or page).evaluate("n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()", name)
def css(selector, prop, p=None): return (p or page).locator(selector).first.evaluate("(el, prop) => getComputedStyle(el)[prop]", prop)
def selector_btn(p=None): return (p or page).get_by_test_id("theme-selector")
def choose(theme_id, p=None):
    pg = p or page
    selector_btn(pg).click(); pg.wait_for_timeout(150)
    pg.locator(f"[data-theme-option={theme_id}]").click(); pg.wait_for_timeout(350)
def saved_theme(ctx=None):
    r = (ctx or context).request.get(BASE + "/api/base/preferences"); assert r.ok, r.status
    return r.json()["theme"]
def api_put(theme, ctx=None, origin=True):
    return (ctx or context).request.put(BASE + "/api/base/preferences", data={"theme": theme}, headers={"origin": BASE})

def sign_in(ctx):
    r = ctx.request.post(BASE + "/api/auth/login", data={"email": EMAIL, "password": PASSWORD}, headers={"origin": BASE})
    assert r.ok, f"sign-in failed: {r.status} {r.text()[:120]}"
    return r

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    sign_in(context)
    page = context.new_page()
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and console_errors.append(m.text))
    navigations = []
    page.on("framenavigated", lambda f: f == page.main_frame and navigations.append(f.url))
    go("/actions")

    # ------------------------------------------------------------------ 1. placement
    def placement():
        order = page.evaluate("""() => {
          const h = document.querySelector('header'); const kids = [...h.querySelectorAll('*')];
          const pos = (el) => el ? kids.indexOf(el) : -1;
          return { brand: pos(h.querySelector('img')), search: pos(h.querySelector('input[type=text]')), theme: pos(h.querySelector('[data-testid=theme-selector]')), user: pos(h.querySelector('button[aria-label="Account menu"]')) };
        }""")
        assert 0 <= order["brand"] < order["search"] < order["theme"] < order["user"], order
        s = page.locator("header input[type=text]").bounding_box(); t = selector_btn().bounding_box(); u = page.get_by_role("button", name="Account menu").bounding_box()
        assert s["x"] + s["width"] <= t["x"] + 1 and t["x"] + t["width"] <= u["x"] + 1, (s, t, u)
        assert abs((t["y"] + t["height"] / 2) - (u["y"] + u["height"] / 2)) < 4, "vertically aligned with the account button"
        assert t["width"] <= 44 and t["height"] <= 44, "compact"
        assert page.get_by_role("button", name=re.compile(r"^Theme: ")).count() == 1
        assert page.locator("header svg").count() >= 2
    check("Navbar order: logo, search, theme selector, account; the selector is a compact icon button", placement)

    # ------------------------------------------------------------------ 2. default
    def default_theme():
        assert theme_attr() == "yellow", theme_attr()
        assert var("--primary") == "#f5be00" and var("--bg-app") == "#faf8f1"
        assert "Golden Hour" in selector_btn().get_attribute("aria-label")
        assert saved_theme() is None, "nothing saved until the person chooses"
        assert page.locator('html[data-theme="yellow"]').count() == 1
        txt = context.request.get(BASE + "/actions").text()
        assert 'data-theme="yellow"' in txt, "the server renders the default theme: no flash"
    check("A person who never chose a theme gets Golden Hour (rendered by the server, nothing saved)", default_theme)

    # ------------------------------------------------------------------ 3. menu
    def menu():
        sb = selector_btn()
        assert sb.get_attribute("aria-haspopup") == "dialog" and sb.get_attribute("aria-expanded") == "false"
        sb.click(); expect(page.get_by_role("dialog", name="Theme library")).to_be_visible()
        assert sb.get_attribute("aria-expanded") == "true"
        opts = page.get_by_role("menuitemradio")
        assert opts.count() == 5
        names = [o.locator("span").nth(4).inner_text() if False else o.inner_text().split("\n")[0] for o in opts.all()]
        assert names == [n for _, n in THEMES], names
        checked = [o.get_attribute("data-theme-option") for o in opts.all() if o.get_attribute("aria-checked") == "true"]
        assert checked == ["yellow"], checked
        for o in opts.all():
            sw = o.locator("span").first.bounding_box(); assert sw["width"] >= 30 and sw["height"] >= 20, "each option shows a color preview"
            tid = o.get_attribute("data-theme-option")
            desc = o.inner_text().split("\n")[1]
            assert desc == DESCRIPTIONS[tid], (tid, desc)
            # the description may wrap onto two lines but must never be clipped
            assert not o.evaluate("e => { const d = e.querySelectorAll('span')[7]; return d.scrollHeight > d.clientHeight + 1; }"), ("description is clipped", tid)
        box = page.get_by_role("dialog", name="Theme library").bounding_box(); vp = page.viewport_size
        assert box["x"] >= 0 and box["x"] + box["width"] <= vp["width"] and box["y"] + box["height"] <= vp["height"]
        page.keyboard.press("Escape"); expect(page.get_by_role("dialog", name="Theme library")).to_have_count(0)
        sb.click(); page.mouse.click(500, 500); expect(page.get_by_role("dialog", name="Theme library")).to_have_count(0)
    check("Selector opens a menu with the 5 themes (name, short description, color preview), the active one marked; Esc and outside click close it", menu)

    def keyboard():
        selector_btn().focus(); page.keyboard.press("Enter")
        page.get_by_role("menuitemradio").first.wait_for()
        assert page.evaluate("document.activeElement.dataset.themeOption") == "yellow", "focus starts on the active theme"
        page.keyboard.press("ArrowDown"); assert page.evaluate("document.activeElement.dataset.themeOption") == "white"
        page.keyboard.press("End"); assert page.evaluate("document.activeElement.dataset.themeOption") == "midnight"
        page.keyboard.press("ArrowDown"); assert page.evaluate("document.activeElement.dataset.themeOption") == "yellow", "wraps around"
        page.keyboard.press("Home"); page.keyboard.press("ArrowUp"); assert page.evaluate("document.activeElement.dataset.themeOption") == "midnight"
        page.keyboard.press("ArrowUp"); assert page.evaluate("document.activeElement.dataset.themeOption") == "blue"
        page.keyboard.press("ArrowUp"); page.keyboard.press("Enter"); page.wait_for_timeout(300)
        assert theme_attr() == "purple", theme_attr()
        choose("yellow"); assert theme_attr() == "yellow"
    check("Selector works with the keyboard (arrows, Home / End, Enter) and has proper roles", keyboard)

    # ------------------------------------------------------------------ 4. switching without reload
    def switching():
        page.evaluate("window.__keep = 'still here'"); start = len(navigations)
        for tid, name in THEMES:
            choose(tid)
            assert theme_attr() == tid
            assert name in selector_btn().get_attribute("aria-label")
            assert page.evaluate("window.__keep") == "still here", "no page reload"
            assert css("body", "backgroundColor") == hex_rgb(var("--bg-page")), (tid, css("body", "backgroundColor"), var("--bg-page"))
            selector_btn().click(); page.wait_for_timeout(120)
            on = [o.get_attribute("data-theme-option") for o in page.get_by_role("menuitemradio").all() if o.get_attribute("aria-checked") == "true"]
            assert on == [tid], on
            page.keyboard.press("Escape")
        assert len(navigations) == start, "switching themes never navigated"
        choose("yellow")
    check("Switching through all 5 themes applies at once, without a reload, and the active one is always marked", switching)

    # ------------------------------------------------------------------ 5. whole system uses the tokens
    def components_follow():
        for tid, _ in THEMES:
            choose(tid)
            exp = lambda n: hex_rgb(var(n))
            assert css("header", "backgroundColor") == exp("--bg-navbar"), (tid, "navbar")
            assert css("nav[aria-label=Primary]", "backgroundColor") == exp("--bg-tabs"), (tid, "tabs")
            assert css("aside[aria-label=Views]", "backgroundColor") == exp("--bg-sidebar"), (tid, "sidebar")
            btn = page.get_by_role("button", name="New action")
            assert btn.evaluate("e => getComputedStyle(e).backgroundColor") == exp("--primary"), (tid, "primary button")
            assert btn.evaluate("e => getComputedStyle(e).color") == exp("--text-on-primary"), (tid, "primary button text")
            page.get_by_role("button", name="Filter", exact=True).click(); page.wait_for_timeout(200)
            pop = page.locator("[role=dialog]").last
            assert pop.evaluate("e => getComputedStyle(e).backgroundColor") == exp("--bg-surface"), (tid, "popover")
            page.keyboard.press("Escape")
            btn.click(); page.wait_for_timeout(700)
            dlg = page.locator("[role=dialog]").last
            assert dlg.evaluate("e => getComputedStyle(e).backgroundColor") == exp("--bg-surface"), (tid, "modal / drawer")
            page.keyboard.press("Escape"); page.wait_for_timeout(300)
        choose("yellow")
    check("Navbar, tabs, sidebar, buttons, popovers and drawers all take their colors from the selected theme (all 5)", components_follow)

    def chrome_theme():
        choose("blue")
        header_bg = css("header", "backgroundColor"); assert header_bg == hex_rgb(var("--bg-navbar")) and header_bg != css("body", "backgroundColor")
        # the dark blue chrome has light text; the light page has dark text
        name_color = page.locator("header p").first.evaluate("e => getComputedStyle(e).color"); main_color = page.locator("h1, h2").first.evaluate("e => getComputedStyle(e).color")
        def lum(c):
            r, g, b = [int(x) for x in re.findall(r"\d+", c)[:3]]; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        assert lum(name_color) > 0.7 and lum(main_color) < 0.25, (name_color, main_color)
        selector_btn().click(); page.wait_for_timeout(150)
        panel = page.get_by_role("dialog", name="Theme library")
        pbg = panel.evaluate("e => getComputedStyle(e).backgroundColor"); assert pbg == hex_rgb(var("--bg-surface")) and lum(pbg) > 0.9, "the menu opened from the dark navbar is a light popover"
        assert lum(panel.get_by_role("menuitemradio").first.evaluate("e => getComputedStyle(e.querySelector('span:nth-child(2) span')).color")) < 0.3, "its text is dark"
        page.keyboard.press("Escape"); choose("yellow")
    check("Sapphire: dark navy navbar / tabs / sidebar with light text frame a light workspace; popovers from the navbar stay light", chrome_theme)

    # ------------------------------------------------------------------ 6. consistency across tabs and views
    def across_pages():
        choose("purple"); page.evaluate("window.__keep = 'spa'")
        for tab in ["Profiles", "Vouchers", "Forms", "Items", "Actions"]:
            page.get_by_role("link", name=tab, exact=True).first.click(); page.wait_for_selector("aside[aria-label=Views]"); page.wait_for_timeout(450)
            assert theme_attr() == "purple", (tab, theme_attr())
            assert css("aside[aria-label=Views]", "backgroundColor") == hex_rgb(var("--bg-sidebar")) and var("--primary") == "#7c3aed", tab
        assert page.evaluate("window.__keep") == "spa", "tabs are client-side navigations"
        for v in ["Action Calendar", "Action Board", "All Actions"]:
            page.locator("aside[aria-label=Views]").get_by_role("button", name=v, exact=True).click(); page.wait_for_timeout(450)
            assert theme_attr() == "purple" and page.evaluate("getComputedStyle(document.body).backgroundColor") == hex_rgb(var("--bg-page")), v
    check("The theme stays the same when moving between tabs and views", across_pages)

    # ------------------------------------------------------------------ 7. persistence
    def persistence():
        choose("blue")
        assert saved_theme() == "blue", "saved to the account"
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        assert theme_attr() == "blue"
        html = context.request.get(BASE + "/forms").text()
        assert 'data-theme="blue"' in html, "the next page is rendered in the saved theme by the server (no flash)"
        go("/vouchers"); assert theme_attr() == "blue"
        row = browser_db_row()
        assert row == "blue", row
    def browser_db_row(): return saved_theme()
    check("The choice is saved to the account, survives a reload and is rendered by the server on the next page", persistence)

    def login_restores():
        choose("midnight"); assert saved_theme() == "midnight"
        # a brand-new browser (no cookies): sign in again -> the account's theme, from the first page
        fresh = browser.new_context(viewport={"width": 1440, "height": 900})
        r = sign_in(fresh)
        assert any(c["name"] == "boss-theme" and c["value"] == "midnight" for c in fresh.cookies()), "login brings the saved theme to this browser"
        p2 = fresh.new_page(); go("/actions", p2)
        assert theme_attr(p2) == "midnight"
        assert "midnight" in fresh.request.get(BASE + "/actions").text().split("<body")[0]
        p2.close(); fresh.close()
        # a browser with another theme in its cookie: the account's saved theme wins once signed in
        other = browser.new_context(viewport={"width": 1440, "height": 900}); other.add_cookies([{"name": "boss-theme", "value": "white", "url": BASE}])
        sign_in(other); p3 = other.new_page(); go("/actions", p3); p3.wait_for_timeout(500)
        assert theme_attr(p3) == "midnight", theme_attr(p3)
        p3.close(); other.close()
        # the sign-in page itself uses the browser's last theme
        anon = browser.new_context(); anon.add_cookies([{"name": "boss-theme", "value": "purple", "url": BASE}]); p4 = anon.new_page()
        p4.goto(BASE + "/sign-in", wait_until="load"); assert theme_attr(p4) == "purple"; p4.close(); anon.close()
    check("Signing in again restores the saved theme; the account's choice wins over another browser's cookie", login_restores)

    def two_tabs():
        second = context.new_page(); go("/profiles", second)
        choose("purple"); page.wait_for_timeout(300)
        second.wait_for_timeout(500)
        assert theme_attr(second) == "purple", theme_attr(second)
        choose("yellow"); second.wait_for_timeout(500); assert theme_attr(second) == "yellow"
        second.close()
    check("Other open browser tabs follow the change at once", two_tabs)

    # ------------------------------------------------------------------ 8. robustness
    def bad_cookie():
        for bad in ["pink", "__proto__", "Yellow", "yellow%3B%7Dbody%7Bdisplay%3Anone", "x"]:
            ctx = browser.new_context(); ctx.add_cookies([{"name": "boss-theme", "value": bad, "url": BASE}]); pg = ctx.new_page()
            pg.goto(BASE + "/sign-in", wait_until="load"); assert theme_attr(pg) == "yellow", (bad, theme_attr(pg))
            assert pg.locator("input").count() >= 1, "the page still renders"
            ctx.close()
        for raw in ["boss-theme=yellow;}body{display:none", 'boss-theme="red"', "boss-theme=", "boss-theme=" + "a" * 3000]:
            ctx = browser.new_context(extra_http_headers={"Cookie": raw}); pg = ctx.new_page()
            r = pg.goto(BASE + "/sign-in", wait_until="load")
            assert r.status < 500 and theme_attr(pg) in ("yellow", "midnight"), (raw[:30], r.status, theme_attr(pg))
            assert pg.evaluate("getComputedStyle(document.body).display") != "none"
            ctx.close()
    check("An unknown or malicious theme cookie falls back to the default theme", bad_cookie)

    def retired_themes():
        # a browser (or account) that saved a theme that has since been removed: red -> Midnight (the original BOSS look), green / orange -> Golden Hour
        for old, now in [("red", "midnight"), ("green", "yellow"), ("orange", "yellow")]:
            ctx = browser.new_context(); ctx.add_cookies([{"name": "boss-theme", "value": old, "url": BASE}]); pg = ctx.new_page()
            pg.goto(BASE + "/sign-in", wait_until="load"); assert theme_attr(pg) == now, (old, theme_attr(pg))
            ctx.close()
        for old in ["red", "green", "orange", "crimson", "ember", "evergreen"]:
            assert api_put(old).status == 422, f"{old} cannot be chosen any more"
        assert page.get_by_role("menuitemradio").count() == 0
        selector_btn().click(); names = [o.inner_text().split("\n")[0] for o in page.get_by_role("menuitemradio").all()]; page.keyboard.press("Escape")
        assert not {"Crimson", "Evergreen", "Ember"} & set(names), names
    check("A saved cookie of a removed theme still renders (red as Midnight, green / orange as Golden Hour); removed themes cannot be chosen", retired_themes)

    def midnight_is_original():
        go("/actions"); choose("midnight")
        assert var("--primary") == "#cf0e38" and var("--accent") == "#00ecfc" and var("--bg-app") == "#051424" and var("--bg-surface") == "#0b1f3a"
        assert css("header", "backgroundColor") == "rgb(11, 31, 58)" and css("body", "backgroundColor") == "rgb(5, 10, 26)"
        assert page.get_by_role("button", name="New action").evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(207, 14, 56)"
        choose("yellow")
    check("Midnight is the original BOSS look: deep navy surfaces with the brand red and cyan accents", midnight_is_original)

    def save_fails():
        go("/actions")
        page.route("**/api/base/preferences", lambda route: route.abort() if route.request.method == "PUT" else route.continue_())
        before = saved_theme(); choose("white")
        assert theme_attr() == "white", "still applied on this device"
        expect(page.get_by_text(re.compile("could not be saved to your account"))).to_be_visible()
        assert saved_theme() == before, "nothing was saved"
        page.unroute("**/api/base/preferences")
        page.route("**/api/base/preferences", lambda route: route.fulfill(status=500, body="{}") if route.request.method == "PUT" else route.continue_())
        choose("blue"); expect(page.get_by_text(re.compile("could not be saved to your account")).first).to_be_visible()
        assert theme_attr() == "blue"
        page.unroute("**/api/base/preferences"); choose("yellow"); assert saved_theme() == "yellow"
    check("If saving fails the theme still applies, a message explains it, and it can be saved again later", save_fails)

    def api_rules():
        assert api_put("pink").status == 422 and api_put("").status == 422
        assert context.request.put(BASE + "/api/base/preferences", data={"theme": "red"}, headers={"origin": "https://evil.example"}).status in (401, 403), "another site cannot change the theme"
        anon = browser.new_context(); assert anon.request.get(BASE + "/api/base/preferences").status == 401; anon.close()
        assert saved_theme() == "yellow"
    check("The preference endpoint validates the theme, refuses other sites and requires sign-in", api_rules)

    # ------------------------------------------------------------------ 9. responsive
    def responsive():
      try:
            # The app is laid out at least 960 px wide (existing design); below that the page scrolls sideways as it always did.
            for w, h in [(1440, 900), (1280, 800), (1100, 800), (960, 800), (768, 900), (414, 800)]:
                page.set_viewport_size({"width": w, "height": h}); go("/actions"); page.wait_for_timeout(300)
                if w >= 960:
                    bb = selector_btn().bounding_box()
                    assert bb and bb["x"] >= 0 and bb["x"] + bb["width"] <= w + 1, (w, bb)
                    assert page.evaluate("document.querySelector('header').scrollWidth <= document.querySelector('header').clientWidth + 1"), f"header overflows at {w}px"
                    search = page.locator("header input[type=text]").bounding_box(); acct = page.get_by_role("button", name="Account menu").bounding_box()
                    assert search["width"] >= 100 and acct["x"] + acct["width"] <= w + 1, (w, search, acct)
                selector_btn().scroll_into_view_if_needed(); selector_btn().click(); page.wait_for_timeout(250)
                panel = page.get_by_role("dialog", name="Theme library").bounding_box()
                assert panel["x"] >= -1 and panel["x"] + panel["width"] <= w + 1, (w, panel)
                assert panel["y"] + panel["height"] <= h, (w, "menu fits the height", panel)
                page.get_by_role("menuitemradio").nth(2).click(); page.wait_for_timeout(250); assert theme_attr() == "purple", w
                choose("yellow")
            page.set_viewport_size({"width": 1440, "height": 900})
      finally:
        page.set_viewport_size({"width": 1440, "height": 900})
    check("The selector is visible from 960 px up, and reachable with its menu on screen at 768 and 414 px", responsive)

    # ------------------------------------------------------------------ 10. readability in every theme (rendered)
    def contrast_everywhere():
        problems = []
        for tid, _ in THEMES:
            choose(tid)
            def audit(label):
                r = page.evaluate(CONTRAST_JS, 4.5); assert r["checked"] > 20, (tid, label, r["checked"])
                problems.extend(f"{tid}/{label}: {b}" for b in r["bad"][:3])
            go("/actions"); audit("grid")
            page.get_by_role("button", name="Filter", exact=True).click(); page.wait_for_timeout(250); audit("filter"); page.keyboard.press("Escape")
            page.get_by_role("button", name="New action").click(); page.wait_for_timeout(800); audit("drawer"); page.keyboard.press("Escape"); page.wait_for_timeout(300)
            page.get_by_role("button", name=re.compile("^Create")).first.click(); page.wait_for_timeout(250); audit("create menu"); page.keyboard.press("Escape")
            selector_btn().click(); page.wait_for_timeout(200); audit("theme menu"); page.keyboard.press("Escape")
            page.get_by_role("button", name="Account menu").click(); page.wait_for_timeout(200); audit("account menu"); page.keyboard.press("Escape")
            for v in ["Action Board", "Action Calendar"]:
                page.locator("aside[aria-label=Views]").get_by_role("button", name=v, exact=True).click(); page.wait_for_timeout(450); audit(v)
            for path in ["/vouchers", "/forms", "/profiles", "/items", "/folios"]:
                go(path); audit(path)
        assert not problems, problems[:8]
        choose("yellow")
    check("Rendered text reaches WCAG AA (4.5:1) in all 5 themes on 12 screens, popovers and drawers", contrast_everywhere)

    # ------------------------------------------------------------------ 11. existing functionality still works while themed
    def functional():
        for tid in ["yellow", "midnight", "white"]:
            choose(tid); go("/actions")
            page.locator("aside[aria-label=Views]").get_by_role("button", name="All Actions", exact=True).click(); page.wait_for_timeout(500)  # the app reopens the last used view
            title = f"Themed {tid} {int(time.time()) % 100000}"
            page.get_by_role("button", name="New action").click(); dlg = page.locator("[role=dialog]").last
            code = dlg.get_by_test_id("code-code") if dlg.get_by_test_id("code-code").count() else None
            assert code is not None and code.get_attribute("readonly") is not None, "the automatic Code stays read-only"
            dlg.get_by_label("Task Title").fill(title); dlg.get_by_role("button", name="Create action").click(); page.wait_for_timeout(900)
            expect(page.get_by_text(title).first).to_be_visible()
            for _ in range(3):
                if page.locator("[role=dialog]").count(): page.keyboard.press("Escape"); page.wait_for_timeout(400)
            page.get_by_role("button", name="Filter", exact=True).click(); page.wait_for_timeout(200); page.keyboard.press("Escape")
            page.get_by_placeholder("Search profiles, transactions, and categories…").fill(title); page.wait_for_timeout(500)
            expect(page.get_by_role("grid").get_by_role("row").filter(has_text=title)).to_have_count(1)
            page.get_by_placeholder("Search profiles, transactions, and categories…").fill("")
        choose("yellow")
    check("Creating records, the read-only Code, filters and search all work in other themes", functional)

    def no_console_errors():
        real = [e for e in console_errors if "favicon" not in e and "Failed to load resource" not in e and "net::ERR_FAILED" not in e]
        assert not real, real[:5]
    check("no console errors or uncaught exceptions (other than the deliberate failed saves)", no_console_errors)
    browser.close()

failed = [n for ok, n in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
if failed: print("FAILED:", *failed, sep="\n  ")
sys.exit(1 if failed else 0)

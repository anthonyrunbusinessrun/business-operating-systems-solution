import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contrast, luminance, parseHex } from "./color";
import { DEFAULT_THEME, THEMES, THEME_IDS, TONE_NAMES, getTheme, isThemeId, readableSurfaces, themeCss } from "./themes";

const TEXT = [["text-primary", 7], ["text-cell", 7], ["text-body", 7], ["text-secondary", 4.5], ["text-dim", 4.5], ["text-muted", 4.5], ["icon-inline", 4.5], ["link", 4.5]] as const;

describe("skin library", () => {
  it("has the eight themes, Yellow first and default, then White, Purple, Red", () => {
    assert.deepEqual([...THEME_IDS], ["yellow", "white", "purple", "red", "blue", "green", "orange", "midnight"]);
    assert.equal(DEFAULT_THEME, "yellow");
    assert.deepEqual(THEMES.map((t) => t.name), ["BOSS Yellow", "BOSS White", "BOSS Purple", "BOSS Red", "BOSS Blue", "BOSS Green", "BOSS Orange", "BOSS Midnight"]);
    assert.equal(THEMES.length, 8);
    assert.equal(new Set(THEMES.map((t) => t.id)).size, 8);
  });

  it("every theme defines the same complete set of tokens", () => {
    const keys = Object.keys(THEMES[0].tokens).sort();
    for (const t of THEMES) assert.deepEqual(Object.keys(t.tokens).sort(), keys, t.id);
    for (const required of ["primary", "primary-hover", "accent", "bg-app", "bg-sidebar", "bg-navbar", "bg-surface", "bg-input", "bg-selected", "text-primary", "text-secondary", "text-muted", "border-subtle", "success", "warning", "danger", "info", "shadow-card", "shadow-popover"]) assert.ok(keys.includes(required), required);
    for (const tone of TONE_NAMES) for (const part of ["bg", "fg", "border"]) assert.ok(keys.includes(`tone-${tone}-${part}`));
  });

  it("themes are visibly different from each other", () => {
    const seen = new Set(THEMES.map((t) => `${t.tokens["bg-app"]}|${t.tokens["primary"]}`));
    assert.equal(seen.size, 8);
    assert.equal(new Set(THEMES.map((t) => t.tokens["primary"])).size, 8, "eight different primary colors");
  });
});

describe("accessibility: every theme meets WCAG AA", () => {
  for (const theme of THEMES) {
    const t = theme.tokens;
    const SURFACES = readableSurfaces(t, !!theme.chrome);
    it(`${theme.name}: text is readable on every surface`, () => {
      for (const s of SURFACES) for (const [name, min] of TEXT) assert.ok(contrast(t[name], s) >= min, `${theme.id}: ${name} ${t[name]} on ${s} = ${contrast(t[name], s).toFixed(2)} (needs ${min})`);
    });
    it(`${theme.name}: buttons, primary text and accent text are readable`, () => {
      for (const p of ["primary", "primary-hover", "primary-dark"]) assert.ok(contrast(t["text-on-primary"], t[p]) >= 4.5, `${theme.id}: text on ${p}`);
      for (const s of SURFACES) {
        assert.ok(contrast(t["primary-text"], s) >= 4.5, `${theme.id}: primary-text on ${s}`);
        assert.ok(contrast(t["accent-text"], s) >= 4.5, `${theme.id}: accent-text on ${s}`);
      }
      assert.ok(contrast(t["accent-text"], t["accent-bg"]) >= 4.5, `${theme.id}: accent-text on accent-bg`);
      assert.ok(contrast(t["text-on-solid"], t["solid"]) >= 4.5, `${theme.id}: text on solid`);
      assert.ok(contrast(t["text-on-danger"], t["danger"]) >= 4.5, `${theme.id}: text on danger`);
      assert.ok(contrast(t["text-on-warning"], t["warning"]) >= 4.5, `${theme.id}: text on warning`);
    });
    it(`${theme.name}: success, warning, error and info colors are readable as text and on their tints`, () => {
      for (const k of ["success", "warning", "danger", "info"]) {
        for (const s of SURFACES) assert.ok(contrast(t[`${k}-text`], s) >= 4.5, `${theme.id}: ${k}-text on ${s}`);
        assert.ok(contrast(t[`${k}-text`], t[`${k}-bg`]) >= 4.5, `${theme.id}: ${k}-text on ${k}-bg`);
      }
    });
    it(`${theme.name}: badge and tag colors are readable`, () => {
      for (const tone of TONE_NAMES) assert.ok(contrast(t[`tone-${tone}-fg`], t[`tone-${tone}-bg`]) >= 4.5, `${theme.id}: tone ${tone} ${t[`tone-${tone}-fg`]} on ${t[`tone-${tone}-bg`]}`);
    });
    it(`${theme.name}: borders and selected states can be seen`, () => {
      assert.ok(contrast(t["border-subtle"], t["bg-surface"]) >= 1.15, `${theme.id}: border on surface`);
      assert.ok(contrast(t["border-strong"], t["bg-input"]) >= 1.5, `${theme.id}: input border`);
      assert.ok(contrast(t["bg-selected"], t["bg-surface"]) >= 1.04, `${theme.id}: selected row differs from surface`);
      assert.ok(contrast(t["primary"], t["bg-surface"]) >= 1.5 || theme.id === "yellow", `${theme.id}: primary stands out from the surface`);
    });
    if (theme.chrome) {
      it(`${theme.name}: the dark chrome (navbar, tabs, sidebar) is readable`, () => {
        const c = theme.chrome!;
        const bgs = [t["bg-navbar"], t["bg-tabs"], t["bg-sidebar"], c["bg-surface"], c["bg-inset"], c["bg-input"], c["bg-selected"]];
        for (const bg of bgs) for (const [name, min] of TEXT) assert.ok(contrast(c[name], bg) >= min, `${theme.id} chrome: ${name} ${c[name]} on ${bg} = ${contrast(c[name], bg).toFixed(2)}`);
        for (const bg of bgs) assert.ok(contrast(c["primary-text"], bg) >= 4.5 && contrast(c["accent-text"], bg) >= 4.5, `${theme.id} chrome: accents on ${bg}`);
        for (const k of ["success", "warning", "danger", "info"]) for (const bg of [...bgs, c[`${k}-bg`]]) assert.ok(contrast(c[`${k}-text`], bg) >= 4.5, `${theme.id} chrome: ${k}-text on ${bg}`);
        for (const tone of TONE_NAMES) assert.ok(contrast(c[`tone-${tone}-fg`], c[`tone-${tone}-bg`]) >= 4.5, `${theme.id} chrome: tone ${tone}`);
      });
    }
  }
});

describe("design direction", () => {
  const warm = (hex: string) => {
    const [r, g, b] = parseHex(hex);
    return Math.max(r, g, b) - Math.min(r, g, b);
  };

  it("light themes use dark text on light backgrounds; dark themes use light text on dark backgrounds", () => {
    for (const t of THEMES) {
      const light = t.scheme === "light";
      assert.equal(luminance(t.tokens["bg-surface"]) > 0.5, light, `${t.id} surface`);
      assert.equal(luminance(t.tokens["text-body"]) < 0.2, light, `${t.id} body text`);
      assert.equal(t.tokens["color-scheme"], t.scheme);
    }
    assert.deepEqual(THEMES.filter((t) => t.scheme === "light").map((t) => t.id), ["yellow", "white", "blue", "green"]);
  });

  it("Yellow stays professional: neutral warm backgrounds, yellow only as the accent, dark text on it", () => {
    const y = getTheme("yellow").tokens;
    for (const k of ["bg-page", "bg-app", "bg-surface", "bg-sidebar", "bg-navbar", "bg-input"]) assert.ok(warm(y[k]) <= 24, `${k} ${y[k]} is a near-neutral warm tone`);
    assert.ok(luminance(y["bg-app"]) > 0.9, "a light page");
    assert.ok(contrast(y["text-on-primary"], y["primary"]) >= 9, "dark text on the yellow button");
    assert.ok(luminance(y["text-on-primary"]) < 0.1);
    assert.ok(contrast(y["primary-text"], y["bg-surface"]) >= 4.5, "yellow used as text is darkened until readable");
  });

  it("White uses dark ink for actions and Blue frames a light page with a dark blue navbar, tabs and sidebar", () => {
    const w = getTheme("white").tokens;
    assert.ok(luminance(w["primary"]) < 0.05, "ink-black primary");
    assert.equal(w["bg-surface"], "#ffffff");
    const b = getTheme("blue");
    for (const k of ["bg-navbar", "bg-tabs", "bg-sidebar"]) assert.ok(luminance(b.tokens[k]) < 0.1, `${k} is dark blue`);
    assert.ok(luminance(b.tokens["bg-app"]) > 0.9);
    assert.ok(b.chrome && b.chrome["color-scheme"] === "dark");
  });

  it("BOSS Red keeps the original brand colors", () => {
    const r = getTheme("red").tokens;
    assert.equal(r["primary"], "#cf0e38");
    assert.equal(r["primary-hover"], "#dc2040");
    assert.equal(r["accent"], "#00ecfc");
    assert.equal(r["bg-page"], "#050a1a");
    assert.equal(r["bg-app"], "#051424");
    assert.equal(r["bg-surface"], "#0b1f3a");
    assert.equal(r["bg-input"], "#0f172a");
    assert.equal(r["border-subtle"], "#1e3a5f");
    assert.equal(r["text-body"], "#e2e8f0");
    assert.equal(r["tone-green-fg"], "#74e0a5");
  });
});

describe("theme CSS and ids", () => {
  it("emits one block per theme, the default also on :root, and chrome blocks for Blue", () => {
    const css = themeCss();
    assert.ok(css.startsWith(":root,[data-theme=\"yellow\"]{"));
    for (const id of THEME_IDS) assert.ok(css.includes(`[data-theme="${id}"]{`), id);
    assert.ok(css.includes('[data-theme="blue"] .boss-chrome{'));
    assert.ok(css.includes('[data-theme="blue"] .boss-chrome [data-boss-surface]{'));
    assert.ok(!css.includes('[data-theme="red"] .boss-chrome'), "only themes with their own chrome get one");
    assert.ok(css.includes("--primary:#f5be00;") && css.includes("color-scheme:light;") && css.includes("color-scheme:dark;"));
  });

  it("only known theme ids are accepted, anything else falls back to the default", () => {
    assert.ok(isThemeId("midnight") && isThemeId("yellow"));
    for (const bad of ["", "Yellow", "pink", "red ", null, undefined, 3, "__proto__", "yellow;}body{display:none"]) assert.equal(isThemeId(bad), false, String(bad));
    assert.equal(getTheme("nope").id, "yellow");
    assert.equal(getTheme(null).id, "yellow");
  });
});

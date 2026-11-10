import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { contrast, hsl, luminance, parseHex } from "./color";
import { DEFAULT_THEME, THEMES, THEME_IDS, TONE_NAMES, getTheme, isThemeId, readableSurfaces, resolveThemeId, themeCss } from "./themes";

const TEXT = [["text-primary", 7], ["text-cell", 7], ["text-body", 7], ["text-secondary", 4.5], ["text-dim", 4.5], ["text-muted", 4.5], ["icon-inline", 4.5], ["link", 4.5]] as const;

describe("skin library", () => {
  it("has the five themes, Golden Hour first and default", () => {
    // the ids are stable storage keys (account preference and cookie); only the names are shown to people
    assert.deepEqual([...THEME_IDS], ["yellow", "white", "purple", "blue", "midnight"]);
    assert.equal(DEFAULT_THEME, "yellow");
    assert.deepEqual(THEMES.map((t) => t.name), ["Golden Hour", "Porcelain", "Amethyst", "Sapphire", "Midnight"]);
    assert.equal(getTheme(DEFAULT_THEME).name, "Golden Hour");
    assert.equal(THEMES.length, 5);
    assert.equal(new Set(THEMES.map((t) => t.id)).size, 5);
    assert.equal(new Set(THEMES.map((t) => t.name)).size, 5);
  });

  it("each theme has its short description (the palette in words)", () => {
    assert.deepEqual(THEMES.map((t) => t.description), [
      "Warm yellow, soft cream, and deep navy accents.",
      "Clean white, soft gray, and ink-black accents.",
      "Deep violet, lavender, and balanced neutral tones.",
      "Rich blue, cool white, and deep navy accents.",
      "Deep navy, bold red, and bright cyan accents.",
    ]);
  });

  it("themes that were removed (Crimson, Evergreen, Ember) are gone from the library", () => {
    for (const gone of ["red", "green", "orange"]) assert.equal(isThemeId(gone), false, gone);
    for (const name of ["Crimson", "Evergreen", "Ember"]) assert.ok(!THEMES.some((t) => t.name === name), name);
  });

  it("a saved id of a removed theme still resolves: the red one to Midnight (the original BOSS look), green and orange to the default", () => {
    assert.equal(resolveThemeId("red"), "midnight");
    assert.equal(resolveThemeId("green"), "yellow");
    assert.equal(resolveThemeId("orange"), "yellow");
    assert.equal(getTheme("red").name, "Midnight");
    assert.equal(getTheme("orange").name, "Golden Hour");
    for (const id of THEME_IDS) assert.equal(resolveThemeId(id), id, "current ids are unchanged");
    for (const bad of ["", "pink", "Red", "red ", "__proto__", "constructor", "toString", "hasOwnProperty", null, undefined, 4, {}, []]) assert.equal(resolveThemeId(bad), null, String(bad));
  });

  it("the old generic names are gone from the source, tests and docs", () => {
    const root = process.cwd();
    const old = /BOSS (Yellow|White|Purple|Red|Blue|Green|Orange|Midnight)\b/;
    const skip = new Set(["node_modules", ".next", ".git", "__pycache__"]);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.(ts|tsx|css|md|py|json|sql|mjs)$/.test(e.name) && e.name !== "package-lock.json" && !f.endsWith("theme.test.ts") && !f.endsWith("CHANGES.md")) {
          if (old.test(fs.readFileSync(f, "utf8"))) hits.push(path.relative(root, f));
        }
      }
    };
    for (const d of ["src", "qa", "docs", "scripts"]) walk(path.join(root, d));
    for (const f of ["README.md", "NEEDS_CLARIFICATION.md"]) if (old.test(fs.readFileSync(path.join(root, f), "utf8"))) hits.push(f);
    assert.deepEqual(hits, [], "still mentions the old names");
  });

  it("every theme defines the same complete set of tokens", () => {
    const keys = Object.keys(THEMES[0].tokens).sort();
    for (const t of THEMES) assert.deepEqual(Object.keys(t.tokens).sort(), keys, t.id);
    for (const required of ["primary", "primary-hover", "accent", "bg-app", "bg-sidebar", "bg-navbar", "bg-surface", "bg-input", "bg-selected", "text-primary", "text-secondary", "text-muted", "border-subtle", "success", "warning", "danger", "info", "shadow-card", "shadow-popover"]) assert.ok(keys.includes(required), required);
    for (const tone of TONE_NAMES) for (const part of ["bg", "fg", "border"]) assert.ok(keys.includes(`tone-${tone}-${part}`));
  });

  it("themes are visibly different from each other", () => {
    const seen = new Set(THEMES.map((t) => `${t.tokens["bg-app"]}|${t.tokens["primary"]}`));
    assert.equal(seen.size, 5);
    assert.equal(new Set(THEMES.map((t) => t.tokens["primary"])).size, 5, "five different primary colors");
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
  /** How colorful a color is, 0 (gray) to 1: the spread of its channels. HSL saturation exaggerates near-white tints. */
  const chroma = (hex: string) => { const c = parseHex(hex); return (Math.max(...c) - Math.min(...c)) / 255; };
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
    assert.deepEqual(THEMES.filter((t) => t.scheme === "light").map((t) => t.id), ["yellow", "white", "blue"]);
  });

  it("Golden Hour stays professional: soft cream backgrounds, yellow only for actions, deep navy accents and text", () => {
    const y = getTheme("yellow").tokens;
    for (const k of ["bg-page", "bg-app", "bg-surface", "bg-sidebar", "bg-navbar", "bg-input"]) assert.ok(warm(y[k]) <= 24, `${k} ${y[k]} is a near-neutral warm tone`);
    assert.ok(luminance(y["bg-app"]) > 0.9, "a light page");
    assert.ok(contrast(y["text-on-primary"], y["primary"]) >= 9, "dark text on the yellow button");
    assert.ok(luminance(y["text-on-primary"]) < 0.1);
    assert.ok(contrast(y["primary-text"], y["bg-surface"]) >= 4.5, "yellow used as text is darkened until readable");
    const navy = (hex: string) => { const c = hsl(hex); return c.h >= 205 && c.h <= 235 && c.l < 0.3; };
    for (const k of ["accent", "solid", "text-primary", "text-body", "text-on-primary"]) assert.ok(navy(y[k]), `${k} ${y[k]} is a deep navy`);
    const cream = hsl(y["bg-app"]); assert.ok(cream.h >= 38 && cream.h <= 55 && cream.l > 0.95, "a soft cream page");
    const gold = hsl(y["primary"]); assert.ok(gold.h >= 40 && gold.h <= 50 && gold.s > 0.9, "warm yellow actions");
  });

  it("Porcelain is white and soft gray with ink-black accents; Sapphire frames a cool white page with a dark navy navbar, tabs and sidebar", () => {
    const w = getTheme("white").tokens;
    assert.ok(luminance(w["primary"]) < 0.05, "ink-black primary");
    assert.ok(luminance(w["accent"]) < 0.05 && chroma(w["accent"]) < 0.12, "ink accent, not a color");
    assert.ok(luminance(w["solid"]) < 0.05, "ink bars and chips");
    assert.equal(w["bg-surface"], "#ffffff");
    for (const k of ["bg-page", "bg-sidebar", "bg-inset", "bg-selected"]) assert.ok(chroma(w[k]) <= 0.06 && hsl(w[k]).l > 0.9 && hsl(w[k]).l < 0.99, `${k} ${w[k]} is a soft gray`);
    const b = getTheme("blue");
    assert.ok(hsl(b.tokens["primary"]).h >= 215 && hsl(b.tokens["primary"]).h <= 235 && hsl(b.tokens["primary"]).s > 0.7, "a rich blue");
    assert.ok(hsl(b.tokens["accent"]).h >= 215 && hsl(b.tokens["accent"]).h <= 235 && hsl(b.tokens["accent"]).l < 0.3, "a deep navy accent");
    assert.ok(hsl(b.tokens["bg-app"]).h >= 205 && hsl(b.tokens["bg-app"]).h <= 225 && hsl(b.tokens["bg-app"]).l > 0.95, "a cool white page");
    for (const k of ["bg-navbar", "bg-tabs", "bg-sidebar"]) assert.ok(luminance(b.tokens[k]) < 0.1, `${k} is dark blue`);
    assert.ok(luminance(b.tokens["bg-app"]) > 0.9);
    assert.ok(b.chrome && b.chrome["color-scheme"] === "dark");
  });

  it("Midnight is the original BOSS look: deep navy, the brand red, bright cyan", () => {
    const m = getTheme("midnight").tokens;
    assert.equal(m["primary"], "#cf0e38", "the BOSS brand red");
    assert.equal(m["primary-hover"], "#dc2040");
    assert.equal(m["accent"], "#00ecfc", "bright cyan");
    assert.equal(m["bg-page"], "#050a1a");
    assert.equal(m["bg-app"], "#051424");
    assert.equal(m["bg-surface"], "#0b1f3a");
    assert.equal(m["bg-navbar"], "#0b1f3a");
    assert.equal(m["bg-input"], "#0f172a");
    assert.equal(m["border-subtle"], "#1e3a5f");
    assert.equal(m["text-body"], "#e2e8f0");
    assert.equal(m["tone-green-fg"], "#74e0a5");
    for (const k of ["bg-page", "bg-app", "bg-surface", "bg-sidebar", "bg-navbar"]) assert.ok(hsl(m[k]).h >= 205 && hsl(m[k]).h <= 235 && hsl(m[k]).l < 0.2, `${k} ${m[k]} is deep navy`);
    assert.ok(hsl(m["primary"]).h >= 345 || hsl(m["primary"]).h <= 5, "red");
    assert.ok(hsl(m["accent"]).h >= 175 && hsl(m["accent"]).h <= 190, "cyan");
  });

  it("Amethyst is violet with a lavender accent and violet-tinted neutrals", () => {
    const a = getTheme("purple").tokens;
    const hue = (hex: string) => hsl(hex).h;
    assert.ok(hue(a["primary"]) >= 255 && hue(a["primary"]) <= 275, "violet");
    assert.ok(hue(a["accent"]) >= 265 && hue(a["accent"]) <= 285 && hsl(a["accent"]).l > 0.75, "lavender");
    assert.ok(hue(a["bg-app"]) >= 255 && hue(a["bg-app"]) <= 280 && hsl(a["bg-app"]).l < 0.12, "deep violet-black page");
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

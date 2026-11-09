import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { contrast, hsl, luminance, parseHex } from "./color";
import { DEFAULT_THEME, THEMES, THEME_IDS, TONE_NAMES, getTheme, isThemeId, readableSurfaces, themeCss } from "./themes";

const TEXT = [["text-primary", 7], ["text-cell", 7], ["text-body", 7], ["text-secondary", 4.5], ["text-dim", 4.5], ["text-muted", 4.5], ["icon-inline", 4.5], ["link", 4.5]] as const;

describe("skin library", () => {
  it("has the eight themes, Golden Hour first and default", () => {
    // the ids are stable storage keys (account preference and cookie); only the names are shown to people
    assert.deepEqual([...THEME_IDS], ["yellow", "white", "purple", "red", "blue", "green", "orange", "midnight"]);
    assert.equal(DEFAULT_THEME, "yellow");
    assert.deepEqual(THEMES.map((t) => t.name), ["Golden Hour", "Porcelain", "Amethyst", "Crimson", "Sapphire", "Evergreen", "Ember", "Midnight"]);
    assert.equal(getTheme(DEFAULT_THEME).name, "Golden Hour");
    assert.equal(THEMES.length, 8);
    assert.equal(new Set(THEMES.map((t) => t.id)).size, 8);
    assert.equal(new Set(THEMES.map((t) => t.name)).size, 8);
  });

  it("each theme has its short description (the palette in words)", () => {
    assert.deepEqual(THEMES.map((t) => t.description), [
      "Warm yellow, soft cream, and deep navy accents.",
      "Clean white, soft gray, and ink-black accents.",
      "Deep violet, lavender, and balanced neutral tones.",
      "Bold red, deep burgundy, and subtle dark accents.",
      "Rich blue, cool white, and deep navy accents.",
      "Natural green, muted sage, and neutral backgrounds.",
      "Warm orange, amber, and charcoal accents.",
      "Deep navy, electric blue, and subtle cyan accents.",
    ]);
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
    assert.deepEqual(THEMES.filter((t) => t.scheme === "light").map((t) => t.id), ["yellow", "white", "blue", "green"]);
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

  it("Crimson is bold brand red on deep burgundy with subtle dark accents", () => {
    const r = getTheme("red").tokens;
    assert.equal(r["primary"], "#cf0e38", "the BOSS brand red is kept");
    assert.ok(hsl(r["primary"]).h >= 345 || hsl(r["primary"]).h <= 5);
    for (const k of ["bg-page", "bg-app", "bg-surface", "bg-sidebar", "bg-navbar", "bg-input", "bg-inset"]) {
      const c = hsl(r[k]);
      assert.ok(c.h >= 335 && c.h <= 355 && c.l < 0.16, `${k} ${r[k]} is deep burgundy`);
    }
    const accent = hsl(r["accent"]); assert.ok(accent.s < 0.6 && accent.h >= 330 && accent.h <= 360, "a muted rose accent, not a bright color");
    assert.ok(luminance(r["solid"]) < 0.1 && hsl(r["solid"]).h >= 335, "burgundy bars and chips");
  });

  it("Amethyst is violet and lavender; Evergreen green with sage and neutral backgrounds; Ember orange and amber on charcoal; Midnight navy, electric blue and a soft cyan", () => {
    const hue = (hex: string) => hsl(hex).h;
    const a = getTheme("purple").tokens;
    assert.ok(hue(a["primary"]) >= 255 && hue(a["primary"]) <= 275, "violet");
    assert.ok(hue(a["accent"]) >= 265 && hue(a["accent"]) <= 285 && hsl(a["accent"]).l > 0.75, "lavender");
    assert.ok(hue(a["bg-app"]) >= 255 && hue(a["bg-app"]) <= 280 && hsl(a["bg-app"]).l < 0.12, "deep violet-black page");
    const g = getTheme("green").tokens;
    assert.ok(hue(g["primary"]) >= 130 && hue(g["primary"]) <= 150, "natural green");
    for (const k of ["bg-sidebar", "bg-tabs", "bg-selected", "bg-inset"]) assert.ok(hue(g[k]) >= 90 && hue(g[k]) <= 130 && chroma(g[k]) <= 0.14, `${k} ${g[k]} is a muted sage`);
    assert.ok(chroma(g["bg-app"]) <= 0.04 && hsl(g["bg-app"]).l > 0.94, "a neutral page");
    assert.ok(hue(g["accent"]) >= 120 && hue(g["accent"]) <= 150 && chroma(g["accent"]) <= 0.2, "a sage accent");
    const e = getTheme("orange").tokens;
    assert.ok(hue(e["primary"]) >= 20 && hue(e["primary"]) <= 30, "orange");
    assert.ok(hue(e["accent"]) >= 38 && hue(e["accent"]) <= 48, "amber");
    for (const k of ["bg-page", "bg-app", "bg-surface", "bg-sidebar"]) assert.ok(chroma(e[k]) <= 0.04 && hsl(e[k]).l < 0.14, `${k} ${e[k]} is charcoal`);
    const m = getTheme("midnight").tokens;
    assert.ok(hue(m["bg-app"]) >= 220 && hue(m["bg-app"]) <= 240 && hsl(m["bg-app"]).l < 0.1, "deep navy");
    assert.ok(hue(m["primary"]) >= 220 && hue(m["primary"]) <= 235 && hsl(m["primary"]).s > 0.85, "electric blue");
    assert.ok(hue(m["accent"]) >= 185 && hue(m["accent"]) <= 195 && hsl(m["accent"]).s < 0.7, "a subtle cyan (not neon)");
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

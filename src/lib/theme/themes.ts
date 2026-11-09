import { contrast, ensureContrast, mix, readableOn, rgba } from "./color";

/**
 * BOSS Skin Library: the single place where theme colors are defined.
 *
 * Every theme is described by a handful of hand-picked colors (`Spec`). `buildTokens` turns them into the full set of
 * CSS custom properties the stylesheets use (`--bg-surface`, `--text-body`, `--primary`, …). Anything that has to be readable
 * (text on a surface, text on the primary color, status colors on their tints, chip labels) is derived with a contrast
 * solver, so it reaches WCAG AA (4.5 : 1) by construction; theme.test.ts checks every pair for every theme.
 *
 * Components never hardcode colors: they use the variables. `themeCss()` emits one `[data-theme="…"]` block per theme.
 */

export const THEME_IDS = ["yellow", "white", "purple", "red", "blue", "green", "orange", "midnight"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "yellow";
export const THEME_COOKIE = "boss-theme";

export const isThemeId = (v: unknown): v is ThemeId => typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);

/** Hues of the badge / tag palette (the choice colors of select fields). */
export const TONE_NAMES = ["blue", "cyan", "green", "yellow", "orange", "red", "pink", "purple", "gray"] as const;
export type ToneName = (typeof TONE_NAMES)[number];

export type Tokens = Record<string, string>;

interface Spec {
  id: ThemeId;
  name: string;
  description: string;
  scheme: "light" | "dark";
  surfaces: { page: string; app: string; navbar: string; tabs: string; sidebar: string; surface: string; inset: string; raised: string; input: string; rowAlt: string; selected: string };
  borders: { subtle: string; strong: string; hover: string; divider: string; dividerSoft: string };
  text: { primary: string; cell: string; body: string; secondary: string; dim: string; muted: string; icon: string };
  primary: { base: string; hover: string; dark: string; on?: string };
  accent: string;
  /** a secondary solid color for bars and chips that carry white (or dark) text */
  solid: string;
  link: string;
  status: { success: string; warning: string; danger: string; info: string };
  /** color of hover overlays: white on dark themes, dark on light ones */
  overlay: string;
  shadowInk: string;
  /** exact values that replace derived ones (a palette that must match fixed values) */
  exact?: Tokens;
  tones?: Partial<Record<ToneName, string>>;
  /** colors for the navbar, tabs and sidebar when they differ from the page (Sapphire: dark blue chrome on a light page) */
  chrome?: ChromeSpec;
}

interface ChromeSpec {
  surfaces: { surface: string; inset: string; raised: string; input: string; selected: string };
  borders: Spec["borders"];
  text: Spec["text"];
  primaryText: string;
  accent: string;
  link: string;
  overlay: string;
}

const TONE_BASE: Record<ToneName, string> = {
  blue: "#3b82f6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
  purple: "#8b5cf6",
  gray: "#94a3b8",
};

/**
 * Surfaces text may sit on: every text color must be readable on all of them. A theme with its own chrome (dark navbar,
 * tabs and sidebar on a light page) checks the page tokens against the page surfaces only; the chrome has its own tokens.
 */
export const readableSurfaces = (t: Tokens, hasChrome = false) => [t["bg-app"], t["bg-surface"], t["bg-inset"], t["bg-input"], t["bg-selected"], t["bg-row-alt"], ...(hasChrome ? [] : [t["bg-sidebar"], t["bg-navbar"], t["bg-tabs"]])];

function buildTokens(s: Spec): Tokens {
  const dark = s.scheme === "dark";
  const t: Tokens = {};
  const { surfaces: sf, borders: b } = s;

  t["bg-page"] = sf.page;
  t["bg-app"] = sf.app;
  t["bg-navbar"] = sf.navbar;
  t["bg-tabs"] = sf.tabs;
  t["bg-sidebar"] = sf.sidebar;
  t["bg-surface"] = sf.surface;
  t["bg-inset"] = sf.inset;
  t["bg-raised"] = sf.raised;
  t["bg-input"] = sf.input;
  t["bg-row-alt"] = sf.rowAlt;
  t["bg-selected"] = sf.selected;
  t["bg-faint"] = rgba(s.overlay, dark ? 0.035 : 0.03);
  t["bg-hover"] = rgba(s.overlay, dark ? 0.06 : 0.055);
  t["bg-hover-strong"] = rgba(s.overlay, dark ? 0.1 : 0.09);
  t["bg-active"] = rgba(s.overlay, dark ? 0.14 : 0.13);
  t["bg-backdrop"] = dark ? "rgba(2, 8, 20, 0.66)" : "rgba(20, 24, 35, 0.45)";

  t["border-subtle"] = b.subtle;
  t["border-strong"] = b.strong;
  t["border-hover"] = b.hover;
  t["navbar-border"] = b.subtle;
  t["divider"] = b.divider;
  t["divider-soft"] = b.dividerSoft;

  // text: every tier must reach 4.5:1 on every surface; tiers that already do are left exactly as given
  const surfaces = readableSurfaces(t, !!s.chrome);
  const text = s.text;
  t["text-primary"] = ensureContrast(text.primary, surfaces, 7);
  t["text-cell"] = ensureContrast(text.cell, surfaces, 7);
  t["text-body"] = ensureContrast(text.body, surfaces, 7);
  t["text-secondary"] = ensureContrast(text.secondary, surfaces, 4.5);
  t["text-dim"] = ensureContrast(text.dim, surfaces, 4.5);
  t["text-muted"] = ensureContrast(text.muted, surfaces, 4.5);
  t["icon-inline"] = ensureContrast(text.icon, surfaces, 4.5);
  t["link"] = ensureContrast(s.link, surfaces, 4.5);

  // primary
  const on = s.primary.on ?? readableOn(s.primary.base);
  t["primary"] = s.primary.base;
  t["primary-hover"] = s.primary.hover;
  t["primary-dark"] = s.primary.dark;
  t["text-on-primary"] = ensureContrast(on, [s.primary.base, s.primary.hover, s.primary.dark], 4.5);
  t["primary-text"] = ensureContrast(s.primary.base, surfaces, 4.5);
  t["primary-bg"] = mix(s.primary.base, sf.surface, dark ? 0.16 : 0.12);
  t["primary-border"] = mix(s.primary.base, sf.surface, 0.55);

  // accent (focus rings, active filters, selected chips)
  t["accent"] = s.accent;
  t["accent-bg"] = mix(s.accent, sf.surface, dark ? 0.14 : 0.11);
  t["accent-text"] = ensureContrast(s.accent, [...surfaces, t["accent-bg"]], 4.5);
  t["accent-border"] = mix(s.accent, sf.surface, 0.5);

  // secondary solid (bars, calendar chips)
  t["solid"] = s.solid;
  t["text-on-solid"] = ensureContrast(readableOn(s.solid), s.solid, 4.5);

  // status colors: solid base + readable text + tint + border
  for (const key of ["success", "warning", "danger", "info"] as const) {
    const base = s.status[key];
    const tint = mix(base, sf.surface, dark ? 0.16 : 0.12);
    t[key] = base;
    t[`${key}-bg`] = tint;
    t[`${key}-text`] = ensureContrast(base, [...surfaces, tint], 4.5);
    t[`${key}-border`] = mix(base, sf.surface, 0.5);
  }
  t["text-on-danger"] = ensureContrast(readableOn(s.status.danger), s.status.danger, 4.5);
  t["text-on-warning"] = ensureContrast(readableOn(s.status.warning), s.status.warning, 4.5);

  // shadows
  t["shadow-ink"] = s.shadowInk;
  t["shadow-card"] = dark ? `0 20px 50px ${rgba(s.shadowInk, 0.45)}` : `0 14px 36px ${rgba(s.shadowInk, 0.14)}`;
  t["shadow-popover"] = dark ? `0 24px 48px ${rgba(s.shadowInk, 0.5)}` : `0 16px 40px ${rgba(s.shadowInk, 0.18)}`;
  t["shadow-glow"] = `0 0 16px ${rgba(s.primary.base, dark ? 0.35 : 0.3)}`;
  t["scrollbar-thumb"] = b.strong;

  // badge / tag palette
  for (const tone of TONE_NAMES) {
    const base = s.tones?.[tone] ?? TONE_BASE[tone];
    const bg = dark ? mix(base, sf.surface, 0.22) : mix(base, "#ffffff", 0.14);
    const fgSeed = dark ? mix("#ffffff", base, 0.5) : base;
    t[`tone-${tone}-bg`] = bg;
    t[`tone-${tone}-border`] = dark ? mix(base, sf.surface, 0.5) : mix(base, "#ffffff", 0.5);
    t[`tone-${tone}-fg`] = ensureContrast(fgSeed, bg, 5);
  }

  t["color-scheme"] = s.scheme;
  Object.assign(t, s.exact ?? {});
  return t;
}

/** Tokens a themed chrome (navbar, tabs, sidebar) overrides inside its own subtree. */
function buildChrome(s: Spec): Tokens {
  const c = s.chrome!;
  const t: Tokens = {};
  const surfaces = [s.surfaces.navbar, s.surfaces.tabs, s.surfaces.sidebar, c.surfaces.surface, c.surfaces.inset, c.surfaces.input, c.surfaces.selected];
  t["bg-surface"] = c.surfaces.surface;
  t["bg-inset"] = c.surfaces.inset;
  t["bg-raised"] = c.surfaces.raised;
  t["bg-input"] = c.surfaces.input;
  t["bg-selected"] = c.surfaces.selected;
  t["bg-faint"] = rgba(c.overlay, 0.035);
  t["bg-hover"] = rgba(c.overlay, 0.07);
  t["bg-hover-strong"] = rgba(c.overlay, 0.11);
  t["bg-active"] = rgba(c.overlay, 0.15);
  t["border-subtle"] = c.borders.subtle;
  t["navbar-border"] = c.borders.subtle;
  t["border-strong"] = c.borders.strong;
  t["border-hover"] = c.borders.hover;
  t["divider"] = c.borders.divider;
  t["divider-soft"] = c.borders.dividerSoft;
  t["text-primary"] = ensureContrast(c.text.primary, surfaces, 7);
  t["text-cell"] = ensureContrast(c.text.cell, surfaces, 7);
  t["text-body"] = ensureContrast(c.text.body, surfaces, 7);
  t["text-secondary"] = ensureContrast(c.text.secondary, surfaces, 4.5);
  t["text-dim"] = ensureContrast(c.text.dim, surfaces, 4.5);
  t["text-muted"] = ensureContrast(c.text.muted, surfaces, 4.5);
  t["icon-inline"] = ensureContrast(c.text.icon, surfaces, 4.5);
  t["link"] = ensureContrast(c.link, surfaces, 4.5);
  t["primary-text"] = ensureContrast(c.primaryText, surfaces, 4.5);
  t["accent"] = c.accent;
  t["accent-bg"] = mix(c.accent, c.surfaces.surface, 0.18);
  t["accent-text"] = ensureContrast(c.accent, [...surfaces, t["accent-bg"]], 4.5);
  t["accent-border"] = mix(c.accent, c.surfaces.surface, 0.5);
  // status colors and chips inside the dark chrome (a category tag in the sidebar, a count badge) are tuned for the dark surface
  for (const key of ["success", "warning", "danger", "info"] as const) {
    const base = s.status[key];
    const tint = mix(base, c.surfaces.surface, 0.16);
    t[`${key}-bg`] = tint;
    t[`${key}-text`] = ensureContrast(base, [...surfaces, tint], 4.5);
    t[`${key}-border`] = mix(base, c.surfaces.surface, 0.5);
  }
  for (const tone of TONE_NAMES) {
    const base = s.tones?.[tone] ?? TONE_BASE[tone];
    const bg = mix(base, c.surfaces.surface, 0.22);
    t[`tone-${tone}-bg`] = bg;
    t[`tone-${tone}-border`] = mix(base, c.surfaces.surface, 0.5);
    t[`tone-${tone}-fg`] = ensureContrast(mix("#ffffff", base, 0.5), bg, 5);
  }
  t["scrollbar-thumb"] = c.borders.strong;
  t["color-scheme"] = "dark";
  return t;
}

/* ------------------------------------------------------------------------------------------- the eight themes */

/**
 * The eight skins. `id` is the stable storage key (it is what the account preference and the cookie hold), `name` is what people see.
 * Keep an id once released: renaming a theme only changes `name`.
 */
const SPECS: Spec[] = [
  {
    id: "yellow",
    name: "Golden Hour",
    description: "Warm yellow, soft cream, and deep navy accents.",
    scheme: "light",
    surfaces: { page: "#f3efe3", app: "#faf8f1", navbar: "#fffdf6", tabs: "#fdf4cf", sidebar: "#fffcf2", surface: "#ffffff", inset: "#f7f3e6", raised: "#f1ecda", input: "#ffffff", rowAlt: "#fbf9f1", selected: "#fff1b8" },
    borders: { subtle: "#e0d8bf", strong: "#c4b98f", hover: "#a1935f", divider: "#ece6d1", dividerSoft: "#f2edda" },
    text: { primary: "#121a2e", cell: "#18213a", body: "#222c47", secondary: "#4a5470", dim: "#566079", muted: "#5e6985", icon: "#2b4170" },
    primary: { base: "#f5be00", hover: "#e3ae00", dark: "#c99700", on: "#14213d" },
    accent: "#1f3a68",
    solid: "#1f3a68",
    link: "#1d4f91",
    status: { success: "#15803d", warning: "#b45309", danger: "#c62828", info: "#1d4f91" },
    overlay: "#14213d",
    shadowInk: "#14213d",
  },
  {
    id: "white",
    name: "Porcelain",
    description: "Clean white, soft gray, and ink-black accents.",
    scheme: "light",
    surfaces: { page: "#eff1f4", app: "#ffffff", navbar: "#ffffff", tabs: "#ffffff", sidebar: "#f6f7f9", surface: "#ffffff", inset: "#f4f5f7", raised: "#eceef2", input: "#ffffff", rowAlt: "#f9fafb", selected: "#e9ecf1" },
    borders: { subtle: "#e1e5eb", strong: "#c2c9d4", hover: "#97a2b3", divider: "#eceff3", dividerSoft: "#f2f4f7" },
    text: { primary: "#0f172a", cell: "#111827", body: "#1f2937", secondary: "#475569", dim: "#556275", muted: "#5f6c80", icon: "#475569" },
    primary: { base: "#111827", hover: "#1f2937", dark: "#000000", on: "#ffffff" },
    accent: "#1f2937",
    solid: "#1f2937",
    link: "#1d4ed8",
    status: { success: "#15803d", warning: "#b45309", danger: "#c62828", info: "#1d4ed8" },
    overlay: "#0f172a",
    shadowInk: "#0f172a",
  },
  {
    id: "purple",
    name: "Amethyst",
    description: "Deep violet, lavender, and balanced neutral tones.",
    scheme: "dark",
    surfaces: { page: "#0f0919", app: "#140c22", navbar: "#1a1030", tabs: "#140c22", sidebar: "#170e2a", surface: "#1e1336", inset: "#170e2b", raised: "#2a1b47", input: "#170e2b", rowAlt: "#181029", selected: "#33205a" },
    borders: { subtle: "#3a2a5e", strong: "#4f3a7e", hover: "#7a5cc0", divider: "#2b1e47", dividerSoft: "#241838" },
    text: { primary: "#ffffff", cell: "#f4f0ff", body: "#e6dff7", secondary: "#b9acd9", dim: "#a496c9", muted: "#9b8dc2", icon: "#b9a7ee" },
    primary: { base: "#7c3aed", hover: "#6d28d9", dark: "#5b21b6", on: "#ffffff" },
    accent: "#d8b4fe",
    solid: "#5b3fd0",
    link: "#c4b5fd",
    status: { success: "#34d399", warning: "#fbbf24", danger: "#f87171", info: "#7dd3fc" },
    overlay: "#ffffff",
    shadowInk: "#000000",
  },
  {
    id: "red",
    name: "Crimson",
    description: "Bold red, deep burgundy, and subtle dark accents.",
    scheme: "dark",
    surfaces: { page: "#12060a", app: "#180a0f", navbar: "#230d15", tabs: "#180a0f", sidebar: "#1e0c13", surface: "#261019", inset: "#1d0b12", raised: "#331823", input: "#1d0b12", rowAlt: "#1b0b11", selected: "#4a1626" },
    borders: { subtle: "#442030", strong: "#5e2e42", hover: "#8f4a63", divider: "#321623", dividerSoft: "#2a121d" },
    text: { primary: "#ffffff", cell: "#fbf1f3", body: "#f0e2e6", secondary: "#c8adb6", dim: "#b79aa2", muted: "#ab8d96", icon: "#d9a7b6" },
    primary: { base: "#cf0e38", hover: "#dc2040", dark: "#b70f36", on: "#ffffff" },
    accent: "#e6a1b2",
    solid: "#8f1d3a",
    link: "#f0a4b8",
    status: { success: "#4ade80", warning: "#fbbf24", danger: "#ff7a85", info: "#7dd3fc" },
    overlay: "#ffffff",
    shadowInk: "#000000",
  },
  {
    id: "blue",
    name: "Sapphire",
    description: "Rich blue, cool white, and deep navy accents.",
    scheme: "light",
    surfaces: { page: "#edf2f9", app: "#f6f8fc", navbar: "#0b2a5b", tabs: "#0e3270", sidebar: "#0f2d63", surface: "#ffffff", inset: "#f1f5fb", raised: "#e8eef8", input: "#ffffff", rowAlt: "#f8fafd", selected: "#e1ebfb" },
    borders: { subtle: "#d3deec", strong: "#b4c4da", hover: "#7f97bb", divider: "#e4ebf5", dividerSoft: "#edf2f9" },
    text: { primary: "#0b1b36", cell: "#10223f", body: "#1b2e4d", secondary: "#475a78", dim: "#52647f", muted: "#5b6c86", icon: "#48608a" },
    primary: { base: "#1d4ed8", hover: "#1e40af", dark: "#1e3a8a", on: "#ffffff" },
    accent: "#1b3070",
    solid: "#1d4ed8",
    link: "#1d4ed8",
    status: { success: "#15803d", warning: "#b45309", danger: "#c62828", info: "#0369a1" },
    overlay: "#0b1b36",
    shadowInk: "#0b1b36",
    chrome: {
      surfaces: { surface: "#143a7a", inset: "#0c2552", raised: "#184486", input: "#0a2250", selected: "#1c4b97" },
      borders: { subtle: "#24498c", strong: "#3a62a8", hover: "#6b92d1", divider: "#1b3f7e", dividerSoft: "#163668" },
      text: { primary: "#ffffff", cell: "#f1f5ff", body: "#e3ebfb", secondary: "#b3c4e6", dim: "#a1b5dc", muted: "#97acd6", icon: "#a9c0ea" },
      primaryText: "#8fb5ff",
      accent: "#7dd3fc",
      link: "#9cc3ff",
      overlay: "#ffffff",
    },
  },
  {
    id: "green",
    name: "Evergreen",
    description: "Natural green, muted sage, and neutral backgrounds.",
    scheme: "light",
    surfaces: { page: "#e9eee6", app: "#f6f8f3", navbar: "#ffffff", tabs: "#e6eee2", sidebar: "#eef3ea", surface: "#ffffff", inset: "#eef3ea", raised: "#e2eadd", input: "#ffffff", rowAlt: "#f8faf5", selected: "#d6e7d3" },
    borders: { subtle: "#d3dccf", strong: "#b2c2ac", hover: "#83997b", divider: "#e1e8dd", dividerSoft: "#ebf0e8" },
    text: { primary: "#0f1a12", cell: "#16221a", body: "#1f2d23", secondary: "#4b5d50", dim: "#566a5b", muted: "#607466", icon: "#3f6a4c" },
    primary: { base: "#17713b", hover: "#12602f", dark: "#0e4d26", on: "#ffffff" },
    accent: "#4f7a5a",
    solid: "#2f6b4a",
    link: "#0b6e5e",
    status: { success: "#15803d", warning: "#b45309", danger: "#c62828", info: "#1d5fa8" },
    overlay: "#0f1a12",
    shadowInk: "#0f1a12",
  },
  {
    id: "orange",
    name: "Ember",
    description: "Warm orange, amber, and charcoal accents.",
    scheme: "dark",
    surfaces: { page: "#0e0e10", app: "#131315", navbar: "#19191c", tabs: "#131315", sidebar: "#161618", surface: "#1c1c20", inset: "#151518", raised: "#26262b", input: "#151518", rowAlt: "#17171a", selected: "#3a2415" },
    borders: { subtle: "#2f2f35", strong: "#45454d", hover: "#6b6b75", divider: "#25252a", dividerSoft: "#1f1f23" },
    text: { primary: "#ffffff", cell: "#f4f4f5", body: "#e4e4e7", secondary: "#a8a8b2", dim: "#9696a1", muted: "#8b8b96", icon: "#d2a86a" },
    primary: { base: "#f97316", hover: "#fb8a3c", dark: "#ea6a0a", on: "#1a0c00" },
    accent: "#fbbf24",
    solid: "#c2410c",
    link: "#f6c177",
    status: { success: "#4ade80", warning: "#fbbf24", danger: "#f87171", info: "#7dd3fc" },
    overlay: "#ffffff",
    shadowInk: "#000000",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep navy, electric blue, and subtle cyan accents.",
    scheme: "dark",
    surfaces: { page: "#050816", app: "#070c1f", navbar: "#0a1128", tabs: "#070c1f", sidebar: "#080e24", surface: "#0e1733", inset: "#0a1129", raised: "#17224a", input: "#0a1129", rowAlt: "#0a112a", selected: "#16275a" },
    borders: { subtle: "#1e2b5a", strong: "#30427f", hover: "#4c66c4", divider: "#16204a", dividerSoft: "#111a3d" },
    text: { primary: "#ffffff", cell: "#f1f5ff", body: "#dce4fa", secondary: "#9fadd8", dim: "#8c9bcb", muted: "#8293c6", icon: "#8fb0ff" },
    primary: { base: "#2b5cff", hover: "#2450e0", dark: "#1e43c0", on: "#ffffff" },
    accent: "#5cc8e0",
    solid: "#2450e0",
    link: "#7aa7ff",
    status: { success: "#34d399", warning: "#fbbf24", danger: "#f87171", info: "#38bdf8" },
    overlay: "#ffffff",
    shadowInk: "#000000",
  },
];

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  scheme: "light" | "dark";
  tokens: Tokens;
  /** present for themes with a differently colored navbar, tabs and sidebar */
  chrome?: Tokens;
  /** five colors for the small preview in the selector */
  swatch: { page: string; surface: string; chrome: string; primary: string; accent: string; text: string };
}

export const THEMES: ThemeDef[] = SPECS.map((s) => {
  const tokens = buildTokens(s);
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    scheme: s.scheme,
    tokens,
    chrome: s.chrome ? buildChrome(s) : undefined,
    swatch: { page: tokens["bg-app"], surface: tokens["bg-surface"], chrome: tokens["bg-navbar"], primary: tokens["primary"], accent: tokens["accent"], text: tokens["text-body"] },
  };
});

export function getTheme(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
}

/** Re-exported for the contrast audit. */
export { contrast };

const declarations = (tokens: Tokens) =>
  Object.entries(tokens)
    .map(([k, v]) => (k === "color-scheme" ? `color-scheme:${v};` : `--${k}:${v};`))
    .join("");

/**
 * All themes as CSS. The default theme also answers to `:root`, so a page without a `data-theme` attribute is still
 * fully styled. A theme with its own chrome re-declares the text / border / input tokens inside `.boss-chrome`, and
 * anything marked `data-boss-surface` inside the chrome (a popover) goes back to the page tokens.
 */
export function themeCss(): string {
  const parts: string[] = [];
  for (const t of THEMES) {
    const sel = t.id === DEFAULT_THEME ? `:root,[data-theme="${t.id}"]` : `[data-theme="${t.id}"]`;
    parts.push(`${sel}{${declarations(t.tokens)}}`);
    if (t.chrome) {
      parts.push(`[data-theme="${t.id}"] .boss-chrome{${declarations(t.chrome)}}`);
      const back: Tokens = {};
      for (const k of Object.keys(t.chrome)) back[k] = t.tokens[k];
      parts.push(`[data-theme="${t.id}"] .boss-chrome [data-boss-surface]{${declarations(back)}}`);
    }
  }
  return parts.join("\n");
}

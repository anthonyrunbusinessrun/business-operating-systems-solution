/**
 * Small color toolkit used to build the themes. Everything works on "#rrggbb" strings, so every theme token that matters
 * for readability is a concrete color that can be checked (see theme.test.ts), not an expression the browser resolves.
 */
export type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex color: ${hex}`);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export const toHex = ([r, g, b]: RGB): string => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` laid over `bg` at `alpha` (0 to 1), as an opaque hex color. */
export function mix(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return toHex([0, 1, 2].map((i) => f[i] * alpha + b[i] * (1 - alpha)) as RGB);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The more readable of two text colors on `bg`. */
export function readableOn(bg: string, light = "#ffffff", dark = "#0b0f19"): string {
  return contrast(light, bg) >= contrast(dark, bg) ? light : dark;
}

/**
 * The color closest to `fg` that still reaches `min` contrast against every background in `bgs`:
 * it is moved toward black or white (whichever direction can reach the target) in small steps.
 */
export function ensureContrast(fg: string, bgs: string | string[], min = 4.5): string {
  const list = Array.isArray(bgs) ? bgs : [bgs];
  const ok = (c: string) => list.every((b) => contrast(c, b) >= min);
  if (ok(fg)) return fg;
  const avg = list.reduce((s, b) => s + luminance(b), 0) / list.length;
  const target = avg > 0.4 ? "#000000" : "#ffffff"; // darken on light backgrounds, lighten on dark ones
  for (let step = 1; step <= 100; step += 1) {
    const c = mix(target, fg, step / 100);
    if (ok(c)) return c;
  }
  return target;
}

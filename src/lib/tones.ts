import type { CSSProperties } from "react";

/**
 * Badge / pill / tag palette. Every color is a theme token (`--tone-*`, `--primary`, `--danger-*`), so the same badge is
 * readable in all skins; the theme values live in src/lib/theme/themes.ts.
 */
export interface Tone {
  bg: string;
  fg: string;
  border?: string;
}

export const TONES = {
  agent: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)" },
  rep: { bg: "var(--primary)", fg: "var(--text-on-primary)" },
  ongoing: { bg: "var(--primary)", fg: "var(--text-on-primary)" },
  queue: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)" },
  scheduled: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)" },
  tasking: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)" },
  training: { bg: "var(--tone-orange-bg)", fg: "var(--tone-orange-fg)" },
  notice: { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow-fg)" },
  chip: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)" },
  work: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  buy: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  blanket: { bg: "var(--tone-cyan-bg)", fg: "var(--tone-cyan-fg)" },
  countRed: { bg: "var(--primary)", fg: "var(--text-on-primary)" },
  countGreen: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  countPurple: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)" },
  countBlue: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)" },
  countMuted: { bg: "var(--danger-bg)", fg: "var(--danger-text)" },
  voucherLabel: { bg: "var(--tone-pink-bg)", fg: "var(--tone-pink-fg)" },
  acct: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)" },
  purchased: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  kitAlpha: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)" },
  kitBeta: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)" },
  kitGamma: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)" },
  kitDelta: { bg: "var(--tone-cyan-bg)", fg: "var(--tone-cyan-fg)" },
  course: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  xmind: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)" },
  workRef: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)", border: "var(--tone-blue-border)" },
  solicitation: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)", border: "var(--tone-blue-border)" },
  sourcesSought: { bg: "var(--tone-orange-bg)", fg: "var(--tone-orange-fg)", border: "var(--tone-orange-border)" },
  combined: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)", border: "var(--tone-green-border)" },
  rfi: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)", border: "var(--tone-purple-border)" },
  comingDue: { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow-fg)" },
  current: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  statusPaid: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  statusOpen: { bg: "var(--tone-cyan-bg)", fg: "var(--tone-cyan-fg)" },
  statusPartial: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)" },
  statusOverdue: { bg: "var(--danger-bg)", fg: "var(--danger-text)" },
  statusDraft: { bg: "var(--tone-gray-bg)", fg: "var(--tone-gray-fg)" },
  statusVoid: { bg: "var(--tone-gray-bg)", fg: "var(--tone-gray-fg)" },
  statusAwaiting: { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow-fg)" },
  billing: { bg: "var(--bg-faint)", fg: "var(--primary-text)" },
} as const satisfies Record<string, Tone>;

export type ToneName = keyof typeof TONES;

export function toneStyle(name: ToneName): CSSProperties {
  const t: Tone = TONES[name];
  return {
    background: t.bg,
    color: t.fg,
    ...(t.border ? { borderColor: t.border } : {}),
  };
}

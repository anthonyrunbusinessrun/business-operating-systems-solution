"use client";

import { Check, Palette } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "@/components/popovers/Popover";
import { useToast } from "@/components/ui/Toast";
import type { ThemeDef } from "@/lib/theme/themes";
import { useTheme } from "./ThemeProvider";
import styles from "./theme.module.css";

const PANEL_WIDTH = 318;

/** A tiny picture of a theme: its page, a card, the primary action and the accent. */
function Swatch({ t }: { t: ThemeDef }) {
  return (
    <span className={styles.swatch} style={{ background: t.swatch.page, borderColor: t.tokens["border-subtle"] }} aria-hidden>
      <span className={styles.swatchBar} style={{ background: t.swatch.chrome }} />
      <span className={styles.swatchCard} style={{ background: t.swatch.surface, borderColor: t.tokens["border-subtle"] }}>
        <span className={styles.swatchPrimary} style={{ background: t.swatch.primary }} />
        <span className={styles.swatchAccent} style={{ background: t.swatch.accent }} />
      </span>
    </span>
  );
}

/** Navbar control between the search box and the account menu: a palette button that opens the skin library. */
export function ThemeSelector() {
  const { theme, themes, setTheme } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // The app is laid out at least 960 px wide, so on a narrower screen the page scrolls sideways; there the menu is pinned to the screen.
  const [pinned, setPinned] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const choose = async (t: ThemeDef) => {
    setOpen(false);
    if (t.id === theme.id) return;
    const saved = await setTheme(t.id);
    if (!saved) toast.error("The theme is applied on this device, but could not be saved to your account. Try again later.");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const i = items.findIndex((el) => el === document.activeElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={PANEL_WIDTH}
      align="right"
      label="Theme library"
      panelStyle={
        pinned
          ? { position: "fixed", top: "calc(var(--header-h) + 8px)", right: 12, left: "auto", maxWidth: "calc(100vw - 24px)" }
          : { top: "calc(100% + 10px)", maxWidth: "calc(100vw - 24px)" }
      }
      trigger={
        <button
          type="button"
          className={styles.trigger}
          aria-label={`Theme: ${theme.name}. Change theme`}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Theme"
          data-testid="theme-selector"
          onClick={() => {
            setPinned(window.matchMedia("(max-width: 959px)").matches);
            setOpen((o) => !o);
          }}
        >
          <Palette size={18} aria-hidden />
          <span className={styles.dot} style={{ background: theme.tokens["primary"] }} aria-hidden />
        </button>
      }
    >
      <div className={styles.panel} onKeyDown={onKeyDown}>
        <p className={styles.heading}>Theme</p>
        <div ref={list} role="menu" aria-label="Themes" className={styles.list}>
          {themes.map((t) => {
            const active = t.id === theme.id;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                data-theme-option={t.id}
                autoFocus={active}
                onClick={() => void choose(t)}
              >
                <Swatch t={t} />
                <span className={styles.optionText}>
                  <span className={styles.optionName}>{t.name}</span>
                  <span className={styles.optionDesc}>{t.description}</span>
                </span>
                <span className={styles.check} aria-hidden>{active && <Check size={16} strokeWidth={2.5} />}</span>
              </button>
            );
          })}
        </div>
        <p className={styles.hint}>Applied instantly and saved to your account.</p>
      </div>
    </Popover>
  );
}

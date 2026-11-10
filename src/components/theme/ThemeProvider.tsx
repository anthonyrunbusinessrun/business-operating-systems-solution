"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_THEME, THEMES, THEME_COOKIE, getTheme, isThemeId, resolveThemeId, type ThemeDef, type ThemeId } from "@/lib/theme/themes";

const STORAGE_KEY = "boss-theme";

interface ThemeContextValue {
  theme: ThemeDef;
  themes: ThemeDef[];
  /** Applies the theme at once (no reload) and saves it to the account. Resolves false when saving to the account failed. */
  setTheme: (id: ThemeId) => Promise<boolean>;
  /** Applies a theme without saving it (used when the account's saved theme arrives). */
  applyTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: getTheme(DEFAULT_THEME),
  themes: THEMES,
  setTheme: async () => false,
  applyTheme: () => undefined,
});

export const useTheme = () => useContext(ThemeContext);

/** Writes the theme to the document: the attribute that selects its CSS variables, the cookie the server reads, the browser UI color. */
function paint(id: ThemeId) {
  const def = getTheme(id);
  document.documentElement.dataset.theme = id;
  document.cookie = `${THEME_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode: the cookie and the account still hold it */
  }
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = def.tokens["bg-navbar"];
}

export function ThemeProvider({ initialTheme, children }: { initialTheme: ThemeId; children: ReactNode }) {
  const [id, setId] = useState<ThemeId>(initialTheme);
  const idRef = useRef(id);
  idRef.current = id;

  const applyTheme = useCallback((next: ThemeId) => {
    if (!isThemeId(next)) return;
    paint(next);
    setId(next);
  }, []);

  const setTheme = useCallback(
    async (next: ThemeId) => {
      if (!isThemeId(next)) return false;
      applyTheme(next); // instant: the page never waits for the network
      try {
        const res = await fetch("/api/base/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) });
        return res.ok;
      } catch {
        return false;
      }
    },
    [applyTheme],
  );

  // other browser tabs of the same person follow the change
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const next = e.key === STORAGE_KEY ? resolveThemeId(e.newValue) : null;
      if (next && next !== idRef.current) {
        document.documentElement.dataset.theme = next;
        setId(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme: getTheme(id), themes: THEMES, setTheme, applyTheme }), [id, setTheme, applyTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Rendered by the signed-in layout: when the theme saved on the account differs from this browser's, the account wins. */
export function ThemeSync({ saved }: { saved: ThemeId | null }) {
  const { theme, applyTheme } = useTheme();
  useEffect(() => {
    if (saved && saved !== theme.id) applyTheme(saved);
    // only when the saved theme arrives, not when the person picks another one afterwards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  return null;
}

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeStyles } from "@/components/theme/ThemeStyles";
import { DEFAULT_THEME, THEME_COOKIE, getTheme, resolveThemeId, type ThemeId } from "@/lib/theme/themes";

export const metadata: Metadata = {
  title: { default: "BOSS", template: "%s · BOSS" },
  description: "Business Operating Systems Solutions",
};

/** The theme this browser last used (a cookie the theme selector writes). Anything unknown falls back to the default. */
async function themeFromCookie(): Promise<ThemeId> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return resolveThemeId(value) ?? DEFAULT_THEME;
}

/** The browser's own UI (mobile address bar) takes the navbar color of the theme. */
export async function generateViewport(): Promise<Viewport> {
  return { themeColor: getTheme(await themeFromCookie()).tokens["bg-navbar"] };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await themeFromCookie();
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <ThemeStyles />
      </head>
      <body>
        <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}

import type { Pool } from "pg";
import { resolveThemeId, type ThemeId } from "@/lib/theme/themes";

/** The saved theme of an account, or null when it never chose one (or the table does not exist yet). */
export async function readUserTheme(pool: Pool, userId: string): Promise<ThemeId | null> {
  try {
    const res = await pool.query<{ theme: string }>("SELECT theme FROM boss_user_preferences WHERE user_id = $1", [userId]);
    const theme = res.rows[0]?.theme;
    return resolveThemeId(theme); // a retired theme id reads as its replacement; an unknown one as "no choice"
  } catch (error) {
    // 42P01: the migration that creates the table has not run yet. The app then simply uses the default theme.
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
}

export async function writeUserTheme(pool: Pool, userId: string, theme: ThemeId): Promise<void> {
  await pool.query(
    `INSERT INTO boss_user_preferences (user_id, theme) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, updated_at = NOW()`,
    [userId, theme],
  );
}

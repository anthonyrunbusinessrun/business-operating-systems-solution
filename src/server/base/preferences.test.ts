import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { Pool } from "pg";
import { THEME_IDS } from "@/lib/theme/themes";
import { readUserTheme } from "./preferences";
import { createTestDb, makeCaller, USER_A, USER_B } from "./testDb";
import { testDatabaseUrl } from "./testDatabaseUrl";

const ADMIN_URL = testDatabaseUrl();

describe("theme preference (per account)", { skip: !ADMIN_URL }, () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let call: ReturnType<typeof makeCaller>;
  before(async () => {
    db = await createTestDb(ADMIN_URL!);
    call = makeCaller(db.pool);
  });
  after(async () => db?.drop());

  it("an account that never chose a theme has none saved; the default is yellow", async () => {
    const r = await call("GET", "preferences");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { theme: null, default: "yellow" });
  });

  it("every theme can be saved and read back; saving again replaces the choice (one row per account)", async () => {
    for (const id of THEME_IDS) {
      const put = await call("PUT", "preferences", { theme: id });
      assert.equal(put.status, 200, id);
      assert.deepEqual(put.json, { theme: id });
      assert.equal((await call("GET", "preferences")).json.theme, id);
    }
    const rows = await db.pool.query("SELECT theme FROM boss_user_preferences WHERE user_id = $1", [USER_A]);
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].theme, "midnight");
  });

  it("different accounts have different themes", async () => {
    await call("PUT", "preferences", { theme: "purple" }, USER_A);
    assert.equal((await call("GET", "preferences", undefined, USER_B)).json.theme, null, "B has not chosen");
    await call("PUT", "preferences", { theme: "blue" }, USER_B);
    assert.equal((await call("GET", "preferences", undefined, USER_A)).json.theme, "purple");
    assert.equal((await call("GET", "preferences", undefined, USER_B)).json.theme, "blue");
  });

  it("only known themes are accepted; a bad value changes nothing", async () => {
    await call("PUT", "preferences", { theme: "blue" });
    for (const bad of ["", "pink", "red", "green", "orange", "Yellow", "yellow ", "__proto__", "yellow;}body{display:none", "red'; DROP TABLE boss_user_preferences;--", null, 7, ["red"], { a: 1 }]) {
      const r = await call("PUT", "preferences", { theme: bad });
      assert.equal(r.status, 422, JSON.stringify(bad));
    }
    assert.equal((await call("PUT", "preferences", {})).status, 422, "no theme at all");
    assert.equal((await call("GET", "preferences")).json.theme, "blue");
    assert.equal((await db.pool.query("SELECT COUNT(*)::int n FROM boss_user_preferences")).rows[0].n >= 1, true, "the table is intact");
  });

  it("needs a signed-in account, and refuses requests from other sites", async () => {
    assert.equal((await call("GET", "preferences", undefined, null)).status, 401);
    assert.equal((await call("PUT", "preferences", { theme: "red" }, null)).status, 401);
    assert.equal((await call("PUT", "preferences", { theme: "red" }, USER_A, { "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal((await call("DELETE", "preferences")).status, 405);
  });

  it("the table only stores plain theme ids, and an id the app no longer knows reads as 'no choice'", async () => {
    await assert.rejects(db.pool.query("INSERT INTO boss_user_preferences (user_id, theme) VALUES ('x', 'Bad Value!')"), /boss_user_preferences_theme_shape/);
    await db.pool.query("INSERT INTO boss_user_preferences (user_id, theme) VALUES ('retired-user', 'retiredtheme') ON CONFLICT (user_id) DO NOTHING");
    assert.equal(await readUserTheme(db.pool, "retired-user"), null, "falls back to the default instead of failing");
  });

  it("an account that saved a removed theme keeps working: red reads as Midnight, green and orange as Golden Hour; saving one is refused", async () => {
    for (const [stored, expected] of [["red", "midnight"], ["green", "yellow"], ["orange", "yellow"]] as const) {
      await db.pool.query("INSERT INTO boss_user_preferences (user_id, theme) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme", [`legacy-${stored}`, stored]);
      assert.equal(await readUserTheme(db.pool, `legacy-${stored}`), expected, stored);
      assert.equal((await call("GET", "preferences", undefined, `legacy-${stored}`)).json.theme, expected, `${stored} through the API`);
      assert.equal((await call("PUT", "preferences", { theme: stored }, `legacy-${stored}`)).status, 422, `${stored} cannot be chosen any more`);
      assert.equal((await call("GET", "preferences", undefined, `legacy-${stored}`)).json.theme, expected, "a refused save changes nothing");
    }
    // the next time the person chooses a theme, the old id is replaced
    await call("PUT", "preferences", { theme: "purple" }, "legacy-red");
    assert.equal((await db.pool.query("SELECT theme FROM boss_user_preferences WHERE user_id = 'legacy-red'")).rows[0].theme, "purple");
  });

  it("a database that has not had the migration yet does not break the app: no saved theme", async () => {
    const missing = { query: async () => { throw Object.assign(new Error('relation "boss_user_preferences" does not exist'), { code: "42P01" }); } } as unknown as Pool;
    assert.equal(await readUserTheme(missing, "anyone"), null);
    const broken = { query: async () => { throw Object.assign(new Error("connection lost"), { code: "57P01" }); } } as unknown as Pool;
    await assert.rejects(readUserTheme(broken, "anyone"), /connection lost/, "other errors are not hidden");
  });

  it("the schema change is additive and safe to apply twice", async () => {
    const sql = await fs.readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
    await db.pool.query(sql);
    await db.pool.query(sql);
    assert.equal((await call("GET", "preferences", undefined, USER_B)).json.theme, "blue", "existing choices survive");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS boss_user_preferences/);
  });
});

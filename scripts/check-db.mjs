// Quick SQLite check — confirms the DB file is reachable/writable:
//   node scripts/check-db.mjs
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* file may not exist */
  }
}
loadEnv(".env.production");
loadEnv(".env.local");

const p = process.argv[2] || process.env.SQLITE_PATH || "./data/chatbotai.db";
const file = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
console.log("SQLite file:", file);

try {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.prepare("CREATE TABLE IF NOT EXISTS _healthcheck (id INTEGER PRIMARY KEY)").run();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  console.log("✅ SQLite OK — tables:", tables.join(", ") || "(none yet — created on first app run)");
  db.close();
  process.exit(0);
} catch (e) {
  console.error("❌ SQLite FAILED:", e.message);
  process.exit(1);
}

// One-off: re-sync the super admin account (email + password + role) from
// .env.local so login works even if the DB was created elsewhere.
//   node scripts/reset-superadmin.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

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
loadEnv(".env.local");

const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD || "";
if (!email || !password) {
  console.error("❌ Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env.local first.");
  process.exit(1);
}

const p = process.env.SQLITE_PATH || "./data/chatbotai.db";
const file = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
console.log("SQLite file:", file);

const db = new Database(file);
const hash = bcrypt.hashSync(password, 10);
const existing = db
  .prepare("SELECT id FROM users WHERE lower(email) = lower(?) OR role = 'superadmin' ORDER BY (role = 'superadmin') DESC, id ASC LIMIT 1")
  .get(email);

if (existing) {
  db.prepare("UPDATE users SET email = ?, password_hash = ?, name = ?, role = 'superadmin', status = 'active' WHERE id = ?").run(
    email, hash, "Super Admin", existing.id
  );
  console.log("✅ Super admin updated:", email);
} else {
  db.prepare("INSERT INTO users (email, password_hash, name, role, status, created_at) VALUES (?, ?, ?, 'superadmin', 'active', ?)").run(
    email, hash, "Super Admin", new Date().toISOString()
  );
  console.log("✅ Super admin created:", email);
}

const row = db.prepare("SELECT id, email, role FROM users WHERE id = (SELECT MAX(id) FROM users WHERE role = 'superadmin')").get();
console.log("Login with →", row ? `${row.email} (role: ${row.role})` : "no super admin found");
db.close();

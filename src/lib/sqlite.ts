import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";

/**
 * SQLite connection (better-sqlite3) — no separate DB server, the database is a
 * single file that lives with the project. Cached on the global object so dev
 * hot-reload / serverless re-evaluation doesn't open a new handle each time.
 */
declare global {
  // eslint-disable-next-line no-var
  var _sqlite: Database.Database | undefined;
}

function resolveDbPath(): string {
  const p =
    process.env.SQLITE_PATH ||
    // Vercel serverless: only /tmp is writable — and it is ephemeral (one
    // DB per warm instance, wiped on cold start). Local/VPS keeps the file
    // next to the project.
    (process.env.VERCEL ? "/tmp/chatbotai.db" : "./data/chatbotai.db");
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

function init(): Database.Database {
  const file = resolveDbPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    return db;
  } catch (e) {
    console.error(`[sqlite] failed to open database at ${file}:`, e);
    throw e;
  }
}

export function getDb(): Database.Database {
  if (!global._sqlite) global._sqlite = init();
  return global._sqlite;
}

/** Kept for call-site compatibility — ensures the DB is initialised. */
export async function connectDB(): Promise<Database.Database> {
  return getDb();
}

/** Absolute path to the live SQLite database file. */
export function dbFilePath(): string {
  return resolveDbPath();
}

/** Produce a consistent snapshot of the DB into `destPath` (uses SQLite's online backup). */
export async function backupTo(destPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await getDb().backup(destPath);
}

/** Dump every table to a plain JSON object (for export/inspection/backup). */
export function exportAllJson(): Record<string, unknown[]> {
  const db = getDb();
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  const out: Record<string, unknown[]> = {};
  for (const t of tables) out[t] = db.prepare(`SELECT * FROM ${t}`).all();
  return out;
}

/** Write a JSON snapshot of the whole DB to `destPath` (safety backup before import). */
export function backupJsonTo(destPath: string): void {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, JSON.stringify(exportAllJson(), null, 2));
}

/**
 * Restore the database from a JSON export (admin import). For every table present
 * in BOTH the file and the live schema, existing rows are replaced with the
 * imported rows — inside one transaction, tolerant of extra/missing columns.
 * Returns counts so the UI can confirm. Caller should back up first.
 */
export function importJson(data: Record<string, unknown>): { tables: number; rows: number } {
  if (!data || typeof data !== "object") throw new Error("Invalid JSON: expected an object of tables.");
  if (!Array.isArray((data as Record<string, unknown>).users) && !Array.isArray((data as Record<string, unknown>).bots)) {
    throw new Error("This file is not a ChatBotAI export (no 'users' or 'bots' table).");
  }
  const db = getDb();
  const liveTables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name)
  );
  const colsOf = (t: string) => new Set((db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));

  let tableCount = 0;
  let rowCount = 0;
  db.pragma("foreign_keys = OFF");
  const run = db.transaction(() => {
    for (const [table, rows] of Object.entries(data)) {
      if (!liveTables.has(table) || !Array.isArray(rows)) continue;
      const cols = colsOf(table);
      db.prepare(`DELETE FROM ${table}`).run();
      for (const row of rows as Record<string, unknown>[]) {
        if (!row || typeof row !== "object") continue;
        const keys = Object.keys(row).filter((k) => cols.has(k));
        if (!keys.length) continue;
        const sql = `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
        db.prepare(sql).run(...keys.map((k) => row[k] as unknown));
        rowCount++;
      }
      tableCount++;
    }
  });
  run();
  db.pragma("foreign_keys = ON");
  return { tables: tableCount, rows: rowCount };
}

/** Lightweight stats for the admin DB page. */
export function dbStats(): { sizeBytes: number; tables: { name: string; rows: number }[] } {
  const db = getDb();
  const file = resolveDbPath();
  let sizeBytes = 0;
  try { sizeBytes = fs.statSync(file).size; } catch {}
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
    .map((t) => ({ name: t.name, rows: (db.prepare(`SELECT COUNT(*) AS c FROM ${t.name}`).get() as { c: number }).c }));
  return { sizeBytes, tables };
}

export function genPublicId(): string {
  // Mirrors Python secrets.token_urlsafe(12) — url-safe base64, ~16 chars.
  return randomBytes(12).toString("base64url");
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Coerce an incoming id (string/number) to a positive integer, or null. */
export function asId(x: unknown): number | null {
  const n = Number(x);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const bool = (v: unknown): 0 | 1 => (v ? 1 : 0);
export const toDate = (v: unknown): Date | null => (v ? new Date(String(v)) : null);

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TEXT,
      smtp_host TEXT DEFAULT '',
      smtp_port INTEGER DEFAULT 587,
      smtp_username TEXT DEFAULT '',
      smtp_password TEXT DEFAULT '',
      smtp_from_email TEXT DEFAULT '',
      smtp_use_tls INTEGER DEFAULT 1,
      notify_email TEXT DEFAULT '',
      last_email_at TEXT,
      last_email_result TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT 'My Chatbot',
      is_active INTEGER DEFAULT 1,
      welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
      menu_prompt TEXT DEFAULT 'Select one of the options below or type your query:',
      system_prompt TEXT DEFAULT 'You are a helpful customer support assistant. Answer briefly and politely.',
      primary_color TEXT DEFAULT '#e60012',
      bubble_icon TEXT DEFAULT '',
      bot_avatar TEXT DEFAULT '',
      user_avatar TEXT DEFAULT '',
      position TEXT DEFAULT 'bottom-right',
      header_title TEXT DEFAULT 'Chat with us',
      header_subtitle TEXT DEFAULT 'We typically reply in a few minutes',
      enable_llm INTEGER DEFAULT 1,
      quick_replies_json TEXT DEFAULT '["Pricing","Support","Hours"]',
      enable_voice INTEGER DEFAULT 0,
      enable_image_upload INTEGER DEFAULT 0,
      vision_model TEXT DEFAULT 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      enable_feedback INTEGER DEFAULT 1,
      enable_human_handoff INTEGER DEFAULT 1,
      enable_sound INTEGER DEFAULT 1,
      auto_open INTEGER DEFAULT 0,
      enable_contact_form INTEGER DEFAULT 1,
      contact_form_title TEXT DEFAULT 'Send us a message',
      contact_form_subtitle TEXT DEFAULT 'We''ll reply by email shortly',
      trained_from_url TEXT DEFAULT '',
      allowed_domains TEXT DEFAULT '',
      domain_cache_text TEXT DEFAULT '',
      domain_cache_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bots_user ON bots(user_id);

    CREATE TABLE IF NOT EXISTS bot_apis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      url TEXT NOT NULL,
      method TEXT DEFAULT 'GET',
      auth_type TEXT DEFAULT 'none',
      token TEXT DEFAULT '',
      header_name TEXT DEFAULT '',
      keywords TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      always_include INTEGER DEFAULT 0,
      use_visitor_token INTEGER DEFAULT 0,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_apis_bot ON bot_apis(bot_id);

    CREATE TABLE IF NOT EXISTS qas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      parent_id INTEGER,
      position INTEGER DEFAULT 0,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      keywords TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      show_in_menu INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_qas_bot ON qas(bot_id);
    CREATE INDEX IF NOT EXISTS idx_qas_parent ON qas(parent_id);

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      session_id TEXT,
      page_url TEXT DEFAULT '',
      mode TEXT DEFAULT 'ai',
      agent_id INTEGER,
      agent_joined_at TEXT,
      visitor_name TEXT DEFAULT '',
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_convos_bot ON conversations(bot_id);
    CREATE INDEX IF NOT EXISTS idx_convos_session ON conversations(session_id);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT DEFAULT '',
      content TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_msgs_convo ON messages(conversation_id);

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER UNIQUE NOT NULL,
      score INTEGER DEFAULT 0,
      comment TEXT DEFAULT '',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bot_id INTEGER,
      conversation_id INTEGER,
      type TEXT DEFAULT 'handoff',
      title TEXT DEFAULT '',
      body TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notifications(user_id);

    -- ---------------- Subscription plans (defined by the super admin) ----------------
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL DEFAULT 0,
      billing_period TEXT DEFAULT 'monthly',   -- monthly | yearly | lifetime
      duration_days INTEGER DEFAULT 30,        -- how long an assignment lasts (0 = unlimited)
      max_bots INTEGER DEFAULT 1,              -- -1 = unlimited
      max_messages_per_month INTEGER DEFAULT 1000, -- -1 = unlimited
      max_agents INTEGER DEFAULT 1,           -- -1 = unlimited
      features_json TEXT DEFAULT '{}',        -- toggles: voice, image, handoff, triggers, departments...
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT
    );

    -- ---------------- Canned / shortcut responses (crisp/tawk style) ----------------
    CREATE TABLE IF NOT EXISTS canned_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,               -- owning account
      shortcut TEXT NOT NULL DEFAULT '',      -- e.g. !hello
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_canned_user ON canned_responses(user_id);

    -- ---------------- Proactive triggers (auto messages) ----------------
    CREATE TABLE IF NOT EXISTS triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT 'Trigger',
      enabled INTEGER DEFAULT 1,
      condition_type TEXT DEFAULT 'time_on_page', -- time_on_page | page_url | scroll | exit_intent
      condition_value TEXT DEFAULT '',            -- seconds | url substring | scroll %
      message TEXT NOT NULL DEFAULT '',
      delay_seconds INTEGER DEFAULT 5,
      once_per_session INTEGER DEFAULT 1,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_triggers_bot ON triggers(bot_id);

    -- ---------------- Departments / teams ----------------
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_departments_user ON departments(user_id);

    -- ---------------- Monthly usage counters (for plan quota enforcement) ----------------
    CREATE TABLE IF NOT EXISTS usage_monthly (
      user_id INTEGER NOT NULL,
      period TEXT NOT NULL,        -- YYYY-MM
      message_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, period)
    );
  `);

  // --- Additive column migrations (safe for existing populated databases) ---
  ensureColumn(db, "users", "role", "TEXT DEFAULT 'user'");            // superadmin | user
  ensureColumn(db, "users", "status", "TEXT DEFAULT 'active'");        // active | banned
  ensureColumn(db, "users", "company", "TEXT DEFAULT ''");
  ensureColumn(db, "users", "plan_id", "INTEGER");
  ensureColumn(db, "users", "plan_started_at", "TEXT");
  ensureColumn(db, "users", "plan_expires_at", "TEXT");
  ensureColumn(db, "users", "created_by", "INTEGER");

  ensureColumn(db, "bots", "website_type", "TEXT DEFAULT 'custom'");   // custom | blog | ecommerce | listing | saas
  ensureColumn(db, "bots", "enable_triggers", "INTEGER DEFAULT 1");

  ensureColumn(db, "conversations", "tags", "TEXT DEFAULT ''");        // comma-separated
  ensureColumn(db, "conversations", "department_id", "INTEGER");
  ensureColumn(db, "conversations", "visitor_email", "TEXT DEFAULT ''");
  ensureColumn(db, "conversations", "visitor_meta", "TEXT DEFAULT ''"); // JSON: referrer, userAgent, ip, country

  seedDefaults(db);
}

/** Add a column only if it doesn't already exist — never drops/rewrites data. */
function ensureColumn(db: Database.Database, table: string, column: string, decl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}

/** Idempotent seeding: default plans + the super admin account from env. */
function seedDefaults(db: Database.Database) {
  const planCount = (db.prepare("SELECT COUNT(*) AS c FROM plans").get() as { c: number }).c;
  if (planCount === 0) {
    const ins = db.prepare(
      `INSERT INTO plans (name, description, price, billing_period, duration_days, max_bots, max_messages_per_month, max_agents, features_json, is_active, sort_order, created_at)
       VALUES (@name, @description, @price, @billing_period, @duration_days, @max_bots, @max_messages_per_month, @max_agents, @features_json, 1, @sort_order, @created_at)`
    );
    const now = nowIso();
    const allOn = JSON.stringify({ voice: true, image: true, handoff: true, triggers: true, departments: true, canned: true, apis: true });
    const basic = JSON.stringify({ voice: false, image: false, handoff: true, triggers: false, departments: false, canned: true, apis: false });
    const pro = JSON.stringify({ voice: true, image: true, handoff: true, triggers: true, departments: true, canned: true, apis: true });
    ins.run({ name: "Free Trial", description: "14-day trial", price: 0, billing_period: "monthly", duration_days: 14, max_bots: 1, max_messages_per_month: 500, max_agents: 1, features_json: basic, sort_order: 1, created_at: now });
    ins.run({ name: "Starter", description: "For small websites & blogs", price: 19, billing_period: "monthly", duration_days: 30, max_bots: 3, max_messages_per_month: 5000, max_agents: 2, features_json: pro, sort_order: 2, created_at: now });
    ins.run({ name: "Business", description: "For e-commerce & listings", price: 49, billing_period: "monthly", duration_days: 30, max_bots: 10, max_messages_per_month: 50000, max_agents: 10, features_json: pro, sort_order: 3, created_at: now });
    ins.run({ name: "Enterprise", description: "Unlimited everything", price: 199, billing_period: "monthly", duration_days: 30, max_bots: -1, max_messages_per_month: -1, max_agents: -1, features_json: allOn, sort_order: 4, created_at: now });
  }

  // Super admin bootstrap from environment. The env file is the source of truth:
  // on every app start the account's email, password and role are re-synced from
  // SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD. This avoids lock-outs caused by a
  // stale password hash when the DB file was created elsewhere (e.g. a project
  // zip copied from another machine) or when the env password was changed later.
  const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "";
  if (!email || !password) {
    console.warn(
      "[sqlite] SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — no admin user was created. " +
      "On a fresh database every login returns 'Invalid credentials' until these env vars are configured."
    );
  }
  if (email && password) {
    const existing = db.prepare(
      "SELECT id, role FROM users WHERE lower(email) = lower(?) OR role = 'superadmin' ORDER BY (role = 'superadmin') DESC, id ASC LIMIT 1"
    ).get(email) as { id: number; role: string } | undefined;
    if (!existing) {
      db.prepare(
        "INSERT INTO users (email, password_hash, name, role, status, created_at) VALUES (?, ?, ?, 'superadmin', 'active', ?)"
      ).run(email, bcrypt.hashSync(password, 10), "Super Admin", nowIso());
    } else {
      db.prepare(
        "UPDATE users SET email = ?, password_hash = ?, name = ?, role = 'superadmin', status = 'active' WHERE id = ?"
      ).run(email, bcrypt.hashSync(password, 10), "Super Admin", existing.id);
    }
  }
}

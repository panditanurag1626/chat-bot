import Database from "better-sqlite3";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const dbPath = path.resolve("data/chatbotai.db");
const db = new Database(dbPath, { readonly: true });

const rows = db
  .prepare("SELECT id, public_id, name, is_active, allowed_domains FROM bots ORDER BY id ASC")
  .all();

console.log("Bots (" + rows.length + "):");
for (const r of rows) {
  console.log(
    `  id=${r.id}  public_id="${r.public_id}"  name="${r.name}"  active=${r.is_active ? "yes" : "NO"}  domains="${r.allowed_domains || "(all)"}"`
  );
}
db.close();

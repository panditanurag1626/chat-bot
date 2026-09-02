// DB entrypoint — now backed by SQLite (better-sqlite3). Re-exported so the
// many `import { connectDB } from "@/lib/db"` call-sites keep working unchanged.
export { connectDB, getDb } from "./sqlite";

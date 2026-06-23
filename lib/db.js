import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "al-mulhim.sqlite");
const resetMarker = "reset_2026_06_23_admin_gemini_v1";

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    generations_count INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
}

if (!columnExists("users", "role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

const resetDone = db.prepare("SELECT value FROM app_meta WHERE key = ?").get(resetMarker);
if (!resetDone) {
  db.exec(`
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name = 'users';
  `);
  db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run(resetMarker, new Date().toISOString());
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    balance: user.balance,
    generationsCount: user.generations_count,
    role: user.role,
    isAdmin: user.role === "admin",
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at
  };
}

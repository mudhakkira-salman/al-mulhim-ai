import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "al-mulhim.sqlite");

export const databaseProvider = process.env.DATABASE_URL ? "postgres" : "sqlite";

let sqliteDb = null;
let pool = null;

if (databaseProvider === "postgres") {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      phone TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      generations_count INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
  `);
} else {
  fs.mkdirSync(dataDir, { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");

  sqliteDb.exec(`
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
  `);

  if (!sqliteColumnExists("users", "role")) {
    sqliteDb.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }
}

function sqliteColumnExists(table, column) {
  return sqliteDb.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
}

function normalizePgUser(row) {
  if (!row) return null;
  return {
    ...row,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    last_login_at: row.last_login_at instanceof Date ? row.last_login_at.toISOString() : row.last_login_at
  };
}

export async function getUserById(id) {
  if (databaseProvider === "postgres") {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return normalizePgUser(result.rows[0]);
  }
  return sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

export async function getUserByEmail(email) {
  if (databaseProvider === "postgres") {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return normalizePgUser(result.rows[0]);
  }
  return sqliteDb.prepare("SELECT * FROM users WHERE email = ?").get(email) || null;
}

export async function getUsersCount() {
  if (databaseProvider === "postgres") {
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM users");
    return result.rows[0].count;
  }
  return sqliteDb.prepare("SELECT COUNT(*) AS count FROM users").get().count;
}

export async function createUser({ email, passwordHash, role, balance }) {
  if (databaseProvider === "postgres") {
    const result = await pool.query(
      `INSERT INTO users (phone, email, password_hash, role, balance)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [null, email, passwordHash, role, balance]
    );
    return normalizePgUser(result.rows[0]);
  }

  const result = sqliteDb
    .prepare("INSERT INTO users (phone, email, password_hash, role, balance) VALUES (?, ?, ?, ?, ?)")
    .run(null, email, passwordHash, role, balance);
  return sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
}

export async function markUserLogin(id) {
  if (databaseProvider === "postgres") {
    const result = await pool.query(
      "UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return normalizePgUser(result.rows[0]);
  }

  sqliteDb.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  return sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export async function chargeGeneration(id) {
  if (databaseProvider === "postgres") {
    const result = await pool.query(
      `UPDATE users
       SET balance = balance - 1, generations_count = generations_count + 1
       WHERE id = $1 AND balance >= 1
       RETURNING *`,
      [id]
    );
    return normalizePgUser(result.rows[0]);
  }

  sqliteDb
    .prepare("UPDATE users SET balance = balance - 1, generations_count = generations_count + 1 WHERE id = ? AND balance >= 1")
    .run(id);
  return sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export async function listUsers() {
  if (databaseProvider === "postgres") {
    const result = await pool.query(
      "SELECT id, phone, email, balance, generations_count, role, created_at, last_login_at FROM users ORDER BY id ASC"
    );
    return result.rows.map(normalizePgUser);
  }

  return sqliteDb
    .prepare("SELECT id, phone, email, balance, generations_count, role, created_at, last_login_at FROM users ORDER BY id ASC")
    .all();
}

export async function addUserBalance(id, amount) {
  if (databaseProvider === "postgres") {
    const result = await pool.query(
      "UPDATE users SET balance = GREATEST(balance + $1, 0) WHERE id = $2 RETURNING *",
      [Math.trunc(amount), id]
    );
    return normalizePgUser(result.rows[0]);
  }

  sqliteDb.prepare("UPDATE users SET balance = MAX(balance + ?, 0) WHERE id = ?").run(Math.trunc(amount), id);
  return sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(id);
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

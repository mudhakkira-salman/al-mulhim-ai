import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, publicUser } from "./lib/db.js";
import { hashPassword, verifyPassword } from "./lib/passwords.js";
import { clearSessionCookie, createSessionCookie, readSessionUserId, serializeCookie } from "./lib/sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5177;

app.use(express.json({ limit: "1mb" }));

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("أدخل بريداً إلكترونياً صحيحاً.");
  return value;
}

function normalizeSaudiPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits) return null;
  if (!/^5\d{8}$/.test(digits)) throw new Error("أدخل رقم جوال سعودي صحيح يبدأ بـ 5.");
  return `+966${digits}`;
}

function normalizeIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (!value) return { email: null, phone: null };
  if (value.includes("@")) return { email: normalizeEmail(value), phone: null };
  return { email: null, phone: normalizeSaudiPhone(value) };
}

function requirePassword(password) {
  const value = String(password || "");
  if (value.length < 8) throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
  return value;
}

function getCurrentUser(req) {
  const userId = readSessionUserId(req);
  if (!userId) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) || null;
}

app.post("/api/register", (req, res) => {
  try {
    const { email, phone } = normalizeIdentifier(req.body.identifier || req.body.email || req.body.phone);
    const password = requirePassword(req.body.password);

    if (!email && !phone) {
      return res.status(400).json({ error: "أدخل البريد الإلكتروني أو رقم الجوال." });
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)")
      .get(email, phone);
    if (existing) {
      return res.status(409).json({ error: "يوجد حساب مسجل بهذه البيانات." });
    }

    const result = db
      .prepare("INSERT INTO users (phone, email, password_hash) VALUES (?, ?, ?)")
      .run(phone, email, hashPassword(password));
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    const cookie = createSessionCookie(user.id);
    res.setHeader("Set-Cookie", serializeCookie(cookie));
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message || "تعذر إنشاء الحساب." });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const { email, phone } = normalizeIdentifier(req.body.identifier);
    const password = String(req.body.password || "");
    if ((!email && !phone) || !password) {
      return res.status(400).json({ error: "أدخل بيانات تسجيل الدخول." });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)")
      .get(email, phone);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة." });
    }

    db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    const cookie = createSessionCookie(user.id);
    res.setHeader("Set-Cookie", serializeCookie(cookie));
    res.json({ user: publicUser(updated) });
  } catch (error) {
    res.status(400).json({ error: error.message || "تعذر تسجيل الدخول." });
  }
});

app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user: publicUser(user) });
});

app.post("/api/password-reset", (_req, res) => {
  res.status(501).json({ error: "استعادة كلمة المرور سيتم تفعيلها لاحقاً." });
});

app.use(express.static(path.join(__dirname, "dist")));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`al-mulhim-ai server running on port ${port}`);
});

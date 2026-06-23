import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, publicUser } from "./lib/db.js";
import { generateArchitecturalImage } from "./lib/gemini.js";
import { hashPassword, verifyPassword } from "./lib/passwords.js";
import { clearSessionCookie, createSessionCookie, readSessionUserId, serializeCookie } from "./lib/sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5177;

app.use(express.json({ limit: "30mb" }));

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("أدخل بريداً إلكترونياً صحيحاً.");
  return value;
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

function requireUser(req, res) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "يجب تسجيل الدخول أولاً." });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== "admin") {
    res.status(403).json({ error: "هذه الصفحة متاحة للأدمن فقط." });
    return null;
  }
  return user;
}

app.post("/api/register", (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || req.body.identifier);
    const password = requirePassword(req.body.password);

    if (!email) {
      return res.status(400).json({ error: "أدخل البريد الإلكتروني." });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "يوجد حساب مسجل بهذا البريد الإلكتروني." });
    }

    const usersCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
    const role = usersCount === 0 ? "admin" : "user";
    const result = db
      .prepare("INSERT INTO users (phone, email, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(null, email, hashPassword(password), role);
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
    const email = normalizeEmail(req.body.email || req.body.identifier);
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "أدخل البريد الإلكتروني وكلمة المرور." });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
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

app.post("/api/generate", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  if (user.balance < 1) {
    return res.status(402).json({ error: "لا توجد محاولات كافية. اشحن رصيدك من حسابي." });
  }

  try {
    if (!req.body.source || !req.body.reference) {
      return res.status(400).json({ error: "ارفع صورة المشروع والصورة المرجعية أولاً." });
    }

    const image = await generateArchitecturalImage({
      source: req.body.source,
      reference: req.body.reference
    });

    db.prepare("UPDATE users SET balance = balance - 1, generations_count = generations_count + 1 WHERE id = ?").run(user.id);
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);

    res.json({ image, user: publicUser(updated) });
  } catch (error) {
    console.error("Generate failed", { userId: user.id, message: error.message });
    res.status(500).json({ error: error.message || "تعذر توليد الصورة." });
  }
});

app.get("/api/admin/users", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const users = db
    .prepare("SELECT id, phone, email, balance, generations_count, role, created_at, last_login_at FROM users ORDER BY id ASC")
    .all()
    .map(publicUser);
  res.json({ users });
});

app.post("/api/admin/users/:id/balance", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const userId = Number(req.params.id);
  const amount = Number(req.body.amount || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: "أدخل عدد محاولات صحيح." });
  }

  db.prepare("UPDATE users SET balance = MAX(balance + ?, 0) WHERE id = ?").run(Math.trunc(amount), userId);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
  res.json({ user: publicUser(user) });
});

app.post("/api/admin/users/balance-by-email", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  try {
    const email = normalizeEmail(req.body.email);
    const amount = Number(req.body.amount || 0);
    if (!email) {
      return res.status(400).json({ error: "أدخل بريد المستخدم." });
    }
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ error: "أدخل عدد محاولات صحيح." });
    }

    const target = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!target) {
      return res.status(404).json({ error: "المستخدم غير موجود. يجب أن ينشئ حساباً أولاً." });
    }

    db.prepare("UPDATE users SET balance = MAX(balance + ?, 0) WHERE id = ?").run(Math.trunc(amount), target.id);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(target.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message || "تعذر تحديث الرصيد." });
  }
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

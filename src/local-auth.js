const authShell = document.createElement("div");
authShell.className = "auth-shell";
authShell.innerHTML = `
  <div class="auth-card glass" dir="rtl">
    <div class="auth-brand">
      <span>AI</span>
      <div>
        <strong>الملهم AI</strong>
        <small>تسجيل محلي آمن</small>
      </div>
    </div>
    <h1 id="authTitle">تسجيل الدخول</h1>
    <p id="authIntro">ادخل بالبريد الإلكتروني أو رقم الجوال السعودي وكلمة المرور.</p>
    <form id="authForm">
      <label class="phone-field">
        <span>البريد الإلكتروني أو الجوال</span>
        <div>
          <input id="authIdentifier" autocomplete="username" placeholder="example@email.com أو 05XXXXXXXX" required />
        </div>
      </label>
      <label class="phone-field">
        <span>كلمة المرور</span>
        <div>
          <input id="authPassword" type="password" autocomplete="current-password" placeholder="8 أحرف على الأقل" required />
        </div>
      </label>
      <button class="auth-primary" id="authSubmit" type="submit">تسجيل الدخول</button>
    </form>
    <button class="auth-primary" id="authToggle" type="button" style="margin-top:12px;background:rgba(255,255,255,.08);color:var(--text);box-shadow:none">
      إنشاء حساب جديد
    </button>
    <button id="resetPasswordButton" type="button" style="width:100%;margin-top:12px;border:0;background:transparent;color:var(--dim);font:inherit;cursor:pointer">
      استعادة كلمة المرور لاحقاً
    </button>
    <div class="auth-message" id="authMessage"></div>
  </div>
`;
document.body.appendChild(authShell);

let mode = "login";
let currentUser = null;

const form = authShell.querySelector("#authForm");
const title = authShell.querySelector("#authTitle");
const intro = authShell.querySelector("#authIntro");
const submit = authShell.querySelector("#authSubmit");
const toggle = authShell.querySelector("#authToggle");
const identifierInput = authShell.querySelector("#authIdentifier");
const passwordInput = authShell.querySelector("#authPassword");
const message = authShell.querySelector("#authMessage");

function setMessage(text, type = "") {
  message.textContent = text || "";
  message.dataset.type = type;
}

function setBusy(isBusy) {
  submit.disabled = isBusy;
  toggle.disabled = isBusy;
  submit.textContent = isBusy ? "جار المعالجة..." : mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
}

function setMode(nextMode) {
  mode = nextMode;
  title.textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
  intro.textContent =
    mode === "login"
      ? "ادخل بالبريد الإلكتروني أو رقم الجوال السعودي وكلمة المرور."
      : "أنشئ حسابك بالبريد الإلكتروني أو رقم الجوال وكلمة مرور فقط.";
  submit.textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
  toggle.textContent = mode === "login" ? "إنشاء حساب جديد" : "لدي حساب بالفعل";
  passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
  setMessage("");
}

function applyUser(user) {
  currentUser = user;
  document.body.classList.toggle("is-authenticated", Boolean(user));
  authShell.hidden = Boolean(user);

  const label = user?.phone || user?.email || "مستخدم";
  const brand = document.querySelector(".brand");
  if (brand && user) brand.title = label;

  const accountHeading = document.querySelector("#accountModal h2");
  if (accountHeading && user) accountHeading.textContent = label;

  const attempts = document.querySelector("#attVal");
  if (attempts && user) attempts.textContent = user.balance ?? 0;

  const used = document.querySelector("#usedVal");
  if (used && user) used.textContent = user.generationsCount ?? 0;

  const bar = document.querySelector("#attBar");
  if (bar && user) bar.textContent = user.balance ?? 0;
}

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "تعذر تنفيذ العملية.");
  return data;
}

async function loadSession() {
  try {
    const data = await api("/api/me");
    applyUser(data.user);
  } catch {
    applyUser(null);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setMessage("");
  try {
    const endpoint = mode === "login" ? "/api/login" : "/api/register";
    const data = await api(endpoint, {
      identifier: identifierInput.value,
      password: passwordInput.value
    });
    applyUser(data.user);
    setMessage(mode === "login" ? "تم تسجيل الدخول." : "تم إنشاء الحساب.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
});

toggle.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

authShell.querySelector("#resetPasswordButton").addEventListener("click", async () => {
  try {
    await api("/api/password-reset", {});
  } catch (error) {
    setMessage(error.message, "error");
  }
});

function wireLogout() {
  const oldButton = document.querySelector("#logoutButton");
  if (!oldButton) return;
  const button = oldButton.cloneNode(true);
  oldButton.replaceWith(button);
  button.addEventListener("click", async () => {
    document.querySelector("#menu")?.classList.remove("is-open");
    try {
      await api("/api/logout", {});
    } finally {
      applyUser(null);
      passwordInput.value = "";
      setMode("login");
      setMessage("تم تسجيل الخروج.", "success");
    }
  });
}

wireLogout();
setMode("login");
loadSession();

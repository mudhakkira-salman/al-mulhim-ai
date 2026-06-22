import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

let confirmationResult = null;
let recaptchaVerifier = null;

const authShell = document.createElement("section");
authShell.className = "auth-shell";
authShell.innerHTML = `
  <div class="auth-card glass">
    <div class="auth-brand">
      <span>AI</span>
      <div>
        <strong>الملهم AI</strong>
        <small>تسجيل الدخول برقم الجوال</small>
      </div>
    </div>
    <h1>ادخل رقم جوالك</h1>
    <p>سيتم إرسال رمز تحقق OTP إلى رقم الجوال السعودي للمتابعة.</p>
    <label class="phone-field">
      <span>رقم الجوال</span>
      <div>
        <b>+966</b>
        <input id="phoneInput" inputmode="numeric" autocomplete="tel" placeholder="5xxxxxxxx" maxlength="9" />
      </div>
    </label>
    <button id="sendOtpButton" class="auth-primary">إرسال رمز OTP</button>
    <div id="otpBlock" class="otp-block" hidden>
      <label class="phone-field">
        <span>رمز التحقق</span>
        <div>
          <input id="otpInput" inputmode="numeric" autocomplete="one-time-code" placeholder="000000" maxlength="6" />
        </div>
      </label>
      <button id="verifyOtpButton" class="auth-primary">تحقق من الرمز</button>
    </div>
    <div id="recaptcha-container" class="recaptcha-box"></div>
    <div id="authMessage" class="auth-message"></div>
  </div>
`;

document.body.prepend(authShell);

const phoneInput = authShell.querySelector("#phoneInput");
const otpInput = authShell.querySelector("#otpInput");
const sendOtpButton = authShell.querySelector("#sendOtpButton");
const verifyOtpButton = authShell.querySelector("#verifyOtpButton");
const otpBlock = authShell.querySelector("#otpBlock");
const authMessage = authShell.querySelector("#authMessage");

function setMessage(message, type = "info") {
  authMessage.textContent = message;
  authMessage.dataset.type = type;
}

function normalizeSaudiPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("966")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  return local.slice(0, 9);
}

phoneInput.addEventListener("input", () => {
  phoneInput.value = normalizeSaudiPhone(phoneInput.value);
});

function getFullPhone() {
  const local = normalizeSaudiPhone(phoneInput.value);
  if (!/^5\d{8}$/.test(local)) {
    throw new Error("أدخل رقم جوال سعودي صحيح يبدأ بـ 5.");
  }
  return `+966${local}`;
}

function ensureRecaptcha() {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "normal",
    callback: () => setMessage("تم التحقق من reCAPTCHA. يمكنك إرسال الرمز.", "success")
  });
  return recaptchaVerifier;
}

sendOtpButton.addEventListener("click", async () => {
  try {
    sendOtpButton.disabled = true;
    setMessage("جاري إرسال رمز التحقق...", "info");
    const phoneNumber = getFullPhone();
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, ensureRecaptcha());
    otpBlock.hidden = false;
    otpInput.focus();
    setMessage("تم إرسال رمز التحقق. أدخل الرمز للمتابعة.", "success");
  } catch (error) {
    console.error("phone-auth-send-error", error);
    setMessage(error.message || "تعذر إرسال رمز التحقق حالياً.", "error");
    if (recaptchaVerifier) {
      try {
        await recaptchaVerifier.clear();
      } catch {}
      recaptchaVerifier = null;
    }
  } finally {
    sendOtpButton.disabled = false;
  }
});

verifyOtpButton.addEventListener("click", async () => {
  try {
    if (!confirmationResult) {
      setMessage("أرسل رمز التحقق أولاً.", "error");
      return;
    }
    verifyOtpButton.disabled = true;
    setMessage("جاري التحقق من الرمز...", "info");
    await confirmationResult.confirm(otpInput.value.trim());
    setMessage("تم تسجيل الدخول بنجاح.", "success");
  } catch (error) {
    console.error("phone-auth-verify-error", error);
    setMessage("رمز التحقق غير صحيح أو منتهي.", "error");
  } finally {
    verifyOtpButton.disabled = false;
  }
});

function setSignedIn(user) {
  document.body.classList.add("is-authenticated");
  authShell.hidden = true;
  const phone = user?.phoneNumber || "مستخدم";
  const brandSmall = document.querySelector(".brand small");
  if (brandSmall) brandSmall.textContent = phone;
  const accountHeading = document.querySelector("#accountModal h2");
  if (accountHeading) accountHeading.textContent = phone;
}

function setSignedOut() {
  document.body.classList.remove("is-authenticated");
  authShell.hidden = false;
}

onAuthStateChanged(auth, (user) => {
  if (user) setSignedIn(user);
  else setSignedOut();
});

function bindLogout() {
  const logoutButton = document.querySelector("#logoutButton");
  if (!logoutButton) return;
  const cleanButton = logoutButton.cloneNode(true);
  logoutButton.replaceWith(cleanButton);
  cleanButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      const menu = document.querySelector("#menu");
      if (menu) menu.classList.remove("is-open");
      setMessage("تم تسجيل الخروج.", "info");
    } catch (error) {
      console.error("phone-auth-signout-error", error);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindLogout);
} else {
  bindLogout();
}

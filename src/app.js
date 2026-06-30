import "./styles.css";

const state = {
  balance: 0,
  attempts: 0,
  used: 0,
  source: null,
  reference: null,
  isGenerating: false
};

const whatsappUrl =
  "https://wa.me/966500830902?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%B1%D8%BA%D8%A8%20%D8%A8%D8%B4%D8%B1%D8%A7%D8%A1%20%D9%85%D8%AD%D8%A7%D9%88%D9%84%D8%A7%D8%AA%20%D8%AA%D9%88%D9%84%D9%8A%D8%AF%20%D9%81%D9%8A%20%D9%85%D9%86%D8%B5%D8%A9%20%D8%A7%D9%84%D9%85%D9%84%D9%87%D9%85%20AI.";

document.querySelector("#app").innerHTML = `
  <main class="app-shell">
    <div class="mesh mesh-a"></div>
    <div class="mesh mesh-b"></div>
    <div class="stars"></div>

    <header class="topbar glass">
      <div class="brand">
        <span class="brand-icon">AI</span>
        <div>
          <strong>الملهم AI</strong>
          <small>تحويل الصور الهندسية إلى تصورات معمارية</small>
        </div>
      </div>

      <button class="menu-button" id="menuButton" aria-label="القائمة">
        <span></span><span></span><span></span>
      </button>

      <div class="menu glass" id="menu">
        <button id="accountButton">حسابي</button>
        <a href="https://wa.me/966500830902" target="_blank" rel="noreferrer">الدعم الفني</a>
        <button id="logoutButton">خروج</button>
      </div>
    </header>

    <section class="hero">
      <div class="hero-copy">
        <span class="badge">واجهة الملهم</span>
        <h1>حوّل الصورة إلى تصور معماري خلال ثوانٍ</h1>
        <p>ارفع صورة المشروع وصورة مرجعية، ثم شاهد النتيجة مباشرة. إذا خرجت من الصفحة بدون تحميل النتيجة فلن يتم حفظها.</p>
      </div>
      <div class="status-card glass">
        <span>الرصيد</span>
        <strong id="balanceText">${state.attempts} محاولة</strong>
      </div>
    </section>

    <section class="workspace">
      <article class="upload-card glass">
        <div class="card-head">
          <span>01</span>
          <h2>صورة المشروع</h2>
        </div>
        <label class="drop-zone" for="sourceInput" id="sourceZone">
          <input id="sourceInput" type="file" accept="image/*" />
          <span class="upload-icon">+</span>
          <strong>ارفع الصورة الأصلية</strong>
          <small>PNG / JPG / WEBP</small>
        </label>
      </article>

      <article class="upload-card glass">
        <div class="card-head">
          <span>02</span>
          <h2>الصورة المرجعية</h2>
        </div>
        <label class="drop-zone" for="referenceInput" id="referenceZone">
          <input id="referenceInput" type="file" accept="image/*" />
          <span class="upload-icon">+</span>
          <strong>ارفع صورة الإلهام</strong>
          <small>خامات، طابع، إضاءة، تفاصيل</small>
        </label>
      </article>

      <article class="result-card glass">
        <div class="card-head">
          <span>03</span>
          <h2>النتيجة</h2>
        </div>
        <div class="result-stage" id="resultStage">
          <div class="result-empty">
            <i></i>
            <strong>ستظهر النتيجة هنا</strong>
            <small>لا يوجد حفظ تلقائي للنتيجة</small>
          </div>
        </div>
      </article>
    </section>

    <section class="actions glass">
      <div>
        <strong>كل توليد = محاولة واحدة</strong>
        <span>لشراء محاولات جديدة تواصل عبر واتساب.</span>
      </div>
      <button class="generate-button" id="generateButton">توليد الآن</button>
    </section>

    <div class="account-modal" id="accountModal" aria-hidden="true">
      <div class="account-panel glass">
        <button class="close-button" id="closeAccount" aria-label="إغلاق">×</button>
        <span class="badge">حسابي</span>
        <h2>ملخص الحساب</h2>
        <div class="account-grid">
          <div><span>المحاولات المتبقية</span><strong>${state.attempts}</strong></div>
          <div><span>عدد محاولات توليد صورة جديدة</span><strong>${state.attempts}</strong></div>
          <div><span>الاستهلاك</span><strong>${state.used} محاولة</strong></div>
        </div>
        <a class="buy-button" href="${whatsappUrl}" target="_blank" rel="noreferrer">شراء محاولات عبر واتساب</a>
      </div>
    </div>
  </main>
`;

const menu = document.querySelector("#menu");
const menuButton = document.querySelector("#menuButton");
const accountModal = document.querySelector("#accountModal");
const resultStage = document.querySelector("#resultStage");
const generateButton = document.querySelector("#generateButton");

menuButton.addEventListener("click", () => menu.classList.toggle("is-open"));
document.querySelector("#accountButton").addEventListener("click", () => {
  menu.classList.remove("is-open");
  accountModal.classList.add("is-open");
  accountModal.setAttribute("aria-hidden", "false");
});
document.querySelector("#closeAccount").addEventListener("click", closeAccount);
accountModal.addEventListener("click", (event) => {
  if (event.target === accountModal) closeAccount();
});
document.querySelector("#logoutButton").addEventListener("click", () => {
  menu.classList.remove("is-open");
  alert("تم تسجيل الخروج من النموذج التجريبي.");
});

function closeAccount() {
  accountModal.classList.remove("is-open");
  accountModal.setAttribute("aria-hidden", "true");
}

function bindUpload(inputId, zoneId, key) {
  const input = document.querySelector(inputId);
  const zone = document.querySelector(zoneId);
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    state[key] = url;
    zone.classList.add("has-image");
    zone.innerHTML = `<input id="${input.id}" type="file" accept="image/*" /><img src="${url}" alt="" /><span class="change-label">تغيير الصورة</span>`;
    bindUpload(inputId, zoneId, key);
  });
}

bindUpload("#sourceInput", "#sourceZone", "source");
bindUpload("#referenceInput", "#referenceZone", "reference");

generateButton.addEventListener("click", () => {
  if (state.isGenerating) return;
  if (!state.source || !state.reference) {
    resultStage.innerHTML = `<div class="soft-alert">ارفع صورة المشروع والصورة المرجعية أولاً.</div>`;
    return;
  }
  state.isGenerating = true;
  generateButton.disabled = true;
  generateButton.textContent = "جاري التوليد...";
  resultStage.innerHTML = `
    <div class="loading-result">
      <span></span>
      <strong>جاري توليد التصور</strong>
      <small>لا تغلق الصفحة قبل تحميل النتيجة.</small>
    </div>
  `;

  window.setTimeout(() => {
    state.isGenerating = false;
    generateButton.disabled = false;
    generateButton.textContent = "توليد جديد";
    resultStage.innerHTML = `
      <div class="mock-result">
        <img src="${state.reference}" alt="" />
        <div class="result-overlay">
          <strong>نتيجة تجريبية</strong>
          <small>في المرحلة التالية يتم ربط التوليد الحقيقي.</small>
          <a download="al-mulhim-result.png" href="${state.reference}">تحميل النتيجة</a>
        </div>
      </div>
    `;
  }, 1800);
});

window.addEventListener("pointermove", (event) => {
  const x = (event.clientX / window.innerWidth - 0.5) * 16;
  const y = (event.clientY / window.innerHeight - 0.5) * 16;
  document.documentElement.style.setProperty("--mx", `${x}px`);
  document.documentElement.style.setProperty("--my", `${y}px`);
});

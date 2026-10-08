// ============================================
//  Money Tracker v0.03.2
//  - Версия в шапке и подвале
//  - Показ текущего профиля
//  - Ссылки на GitHub
// ============================================

const APP_VERSION = "0.03";

const STORAGE_KEY = "moneyTracker_v03";
const LAST_PROFILE_KEY = "moneyTracker_lastProfile";

let currentProfile = null;
let currentDailyExpenses = [];
let currentDailyIncomes = [];
let modalType = "expense";

// ============================================
//  УТИЛИТЫ
// ============================================

function rub(n) {
  if (!isFinite(n)) n = 0;
  return n.toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });
}

function todayShort() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

function getFieldValue(fieldName) {
  const inputs = document.querySelectorAll(`[data-field="${fieldName}"]`);
  let sum = 0;
  inputs.forEach((input) => {
    if (input.closest(".hidden")) return;
    const val = parseFloat(input.value);
    if (!isNaN(val)) sum += val;
  });
  return sum;
}

function getVisibleInputs() {
  return document.querySelectorAll(".profile:not(.hidden) input[data-field]");
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================
//  ПРОФИЛИ
// ============================================

function selectProfile(name) {
  currentProfile = name;
  localStorage.setItem(LAST_PROFILE_KEY, name);

  document.getElementById("profileSelect").classList.add("hidden");
  document
    .querySelectorAll(".profile")
    .forEach((p) => p.classList.add("hidden"));

  const target = document.getElementById("profile-" + name);
  if (target) target.classList.remove("hidden");

  [
    "dailyExpensesCard",
    "dailyIncomesCard",
    "limitCard",
    "resultCard",
    "resetBtn",
  ].forEach((id) => document.getElementById(id).classList.remove("hidden"));

  loadData();
  loadOperations();
  renderAll();
  calculate();
}

function backToProfiles() {
  document
    .querySelectorAll(".profile")
    .forEach((p) => p.classList.add("hidden"));
  [
    "dailyExpensesCard",
    "dailyIncomesCard",
    "limitCard",
    "resultCard",
    "resetBtn",
  ].forEach((id) => document.getElementById(id).classList.add("hidden"));
  document.getElementById("profileSelect").classList.remove("hidden");

  currentProfile = null;

  // ВАЖНО: забываем последний профиль, чтобы F5 остался на выборе
  localStorage.removeItem(LAST_PROFILE_KEY);
}

// ============================================
//  ОПЕРАЦИИ
// ============================================

function loadOperations() {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const data = all[currentProfile] || {};
  currentDailyExpenses = data.dailyExpenses || [];
  currentDailyIncomes = data.dailyIncomes || [];
}

function saveOperations() {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  if (!all[currentProfile]) all[currentProfile] = {};
  all[currentProfile].dailyExpenses = currentDailyExpenses;
  all[currentProfile].dailyIncomes = currentDailyIncomes;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ============================================
//  РЕНДЕР СПИСКОВ
// ============================================

function renderList(listEl, items, type) {
  if (items.length === 0) {
    const msg =
      type === "expense"
        ? "Пока расходов нет. Всё под контролем 😌"
        : "Пока доходов нет";
    listEl.innerHTML = `<li class="empty-ops">${msg}</li>`;
    return;
  }

  listEl.innerHTML = items
    .map(
      (op, i) => `
        <li class="op-item">
            <span class="op-text">
                <strong class="op-amount ${type}">${type === "expense" ? "−" : "+"}${rub(op.amount)}</strong>
                — ${escapeHtml(op.comment) || "без комментария"}
                <span style="color:var(--text-muted);font-size:12px;">(${op.date})</span>
            </span>
            <button class="op-delete" onclick="deleteOperation('${type}', ${i})" title="Удалить">✕</button>
        </li>
    `,
    )
    .join("");
}

function renderAll() {
  renderList(
    document.getElementById("dailyExpensesList"),
    currentDailyExpenses,
    "expense",
  );
  renderList(
    document.getElementById("dailyIncomesList"),
    currentDailyIncomes,
    "income",
  );

  const totalExp = currentDailyExpenses.reduce((s, o) => s + o.amount, 0);
  const totalInc = currentDailyIncomes.reduce((s, o) => s + o.amount, 0);

  document.getElementById("dailyExpensesTotal").textContent = rub(totalExp);
  document.getElementById("dailyIncomesTotal").textContent = rub(totalInc);
}

function deleteOperation(type, index) {
  if (type === "expense") currentDailyExpenses.splice(index, 1);
  else currentDailyIncomes.splice(index, 1);

  saveOperations();
  renderAll();
  calculate();
}

// ============================================
//  МОДАЛКА
// ============================================

function openModal(type) {
  modalType = type;
  const title = type === "expense" ? "Новый расход" : "Новый доход";
  document.getElementById("modalTitle").textContent = title;

  const saveBtn = document.getElementById("modalSaveBtn");
  saveBtn.classList.toggle("income", type === "income");

  document.getElementById("modalAmount").value = "";
  document.getElementById("modalComment").value = "";
  document.getElementById("operationModal").classList.remove("hidden");
  document.getElementById("modalAmount").focus();
}

function closeModal() {
  document.getElementById("operationModal").classList.add("hidden");
}

function saveOperation() {
  const amount = parseFloat(document.getElementById("modalAmount").value);
  const comment = document.getElementById("modalComment").value.trim();

  if (!amount || amount <= 0) {
    alert("Введи сумму больше нуля");
    return;
  }

  const op = {
    amount: amount,
    comment: comment,
    date: todayShort(),
  };

  if (modalType === "expense") currentDailyExpenses.push(op);
  else currentDailyIncomes.push(op);

  saveOperations();
  renderAll();
  calculate();
  closeModal();
}

// ============================================
//  РАСЧЁТ
// ============================================

function calculate() {
  if (!currentProfile) return;

  // Доходы (все возможные поля — у кого нет, тот вернёт 0)
  const incomeFields = [
    "salary",
    "advance",
    "salary2",
    "advance2",
    "benefits",
    "alimony",
  ];
  let totalIncome = 0;
  incomeFields.forEach((f) => (totalIncome += getFieldValue(f)));

  // Обязательные
  const fixedFields = [
    "utilities",
    "rent",
    "credits",
    "subscriptions",
    "school",
  ];
  let totalFixed = 0;
  fixedFields.forEach((f) => (totalFixed += getFieldValue(f)));

  // Повседневные
  const totalDailyExpense = currentDailyExpenses.reduce(
    (s, o) => s + o.amount,
    0,
  );
  const totalDailyIncome = currentDailyIncomes.reduce(
    (s, o) => s + o.amount,
    0,
  );

  // Остаток с прошлого
  const carryOver = getFieldValue("carryOver");

  // Итог
  const balance =
    totalIncome + totalDailyIncome + carryOver - totalFixed - totalDailyExpense;
  const perDay = balance > 0 ? balance / 30 : 0;

  setResult("totalIncome", rub(totalIncome));
  setResult("totalDailyIncome", rub(totalDailyIncome));
  setResult("totalFixed", rub(totalFixed));
  setResult("totalDailyExpense", rub(totalDailyExpense));
  setResult("balance", rub(balance));
  setResult("perDay", rub(perDay));

  // Лимит
  const limit = getFieldValue("limit");
  const left = limit - totalDailyExpense;

  document.getElementById("limitValue").textContent = rub(limit);
  document.getElementById("limitSpent").textContent = rub(totalDailyExpense);
  document.getElementById("limitLeft").textContent = rub(left);

  const fill = document.getElementById("limitProgress");
  let percent = limit > 0 ? (totalDailyExpense / limit) * 100 : 0;
  if (percent > 100) percent = 100;
  fill.style.width = percent + "%";
  fill.classList.remove("warning", "danger");
  if (totalDailyExpense > limit) fill.classList.add("danger");
  else if (percent > 75) fill.classList.add("warning");

  updateStatus(balance, totalIncome + totalDailyIncome + carryOver);
  saveData();
}

function setResult(name, value) {
  const el = document.querySelector(`[data-result="${name}"]`);
  if (el) el.textContent = value;
}

function updateStatus(balance, totalAvailable) {
  const status = document.getElementById("status");
  status.className = "status";
  status.textContent = "";

  if (totalAvailable === 0 && balance === 0) return;

  const ratio = totalAvailable > 0 ? balance / totalAvailable : 0;

  if (balance < 0) {
    status.textContent = "🔴 Расходы больше доходов!";
    status.classList.add("red", "show");
  } else if (ratio < 0.1) {
    status.textContent = "🔴 Впритык — почти ничего не остаётся";
    status.classList.add("red", "show");
  } else if (ratio < 0.3) {
    status.textContent = "🟡 Остаток небольшой, будь аккуратнее";
    status.classList.add("yellow", "show");
  } else {
    status.textContent = "🟢 Всё в порядке, есть запас";
    status.classList.add("green", "show");
  }
}

// ============================================
//  СОХРАНЕНИЕ / ЗАГРУЗКА
// ============================================

function saveData() {
  if (!currentProfile) return;

  const data = {};
  getVisibleInputs().forEach((input) => {
    data[input.dataset.field] = input.value;
  });
  ["limit", "carryOver"].forEach((field) => {
    const input = document.querySelector(`[data-field="${field}"]`);
    if (input) data[field] = input.value;
  });

  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  if (!all[currentProfile]) all[currentProfile] = {};
  all[currentProfile] = Object.assign({}, all[currentProfile], data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function loadData() {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const data = all[currentProfile];
  if (!data) return;

  getVisibleInputs().forEach((input) => {
    const f = input.dataset.field;
    if (data[f] !== undefined) input.value = data[f];
  });

  ["limit", "carryOver"].forEach((field) => {
    const input = document.querySelector(`[data-field="${field}"]`);
    if (input && data[field] !== undefined) input.value = data[field];
  });
}

// ============================================
//  СБРОС
// ============================================

function resetAll() {
  if (!confirm("Сбросить все данные для этого профиля?")) return;

  getVisibleInputs().forEach((input) => (input.value = ""));
  ["limit", "carryOver"].forEach((field) => {
    const input = document.querySelector(`[data-field="${field}"]`);
    if (input) input.value = "";
  });

  currentDailyExpenses = [];
  currentDailyIncomes = [];

  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  delete all[currentProfile];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  renderAll();
  calculate();
}

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================

document.querySelectorAll(".profile-btn").forEach((btn) => {
  btn.addEventListener("click", () => selectProfile(btn.dataset.profile));
});

document
  .getElementById("modalSaveBtn")
  .addEventListener("click", saveOperation);

document.getElementById("modalAmount").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveOperation();
});

document.getElementById("operationModal").addEventListener("click", (e) => {
  if (e.target.id === "operationModal") closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

document.querySelectorAll("input[data-field]").forEach((input) => {
  input.addEventListener("input", calculate);
});

// Инициализация: если есть сохранённый профиль — открываем его
(function initApp() {
  // Выводим версию
  const headerEl = document.getElementById("headerVersion");
  if (headerEl) headerEl.textContent = "v" + APP_VERSION + " · beta";

  const footerEl = document.getElementById("footerVersion");
  if (footerEl) footerEl.textContent = "v" + APP_VERSION;

  // Открываем последний профиль, если он есть
  const last = localStorage.getItem(LAST_PROFILE_KEY);
  if (!last) return;

  const el = document.getElementById("profile-" + last);
  if (el) {
    selectProfile(last);
  } else {
    localStorage.removeItem(LAST_PROFILE_KEY);
  }
})();

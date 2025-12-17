/* =========================================================
   app.js — NEW CURRENCY MECHANISM (SIMPLE & SAFE)
========================================================= */

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = v => Number(v || 0).toFixed(2);

/* ================= CONFIG ================= */

const LS_STATE = "trip_state_v1";
const LS_RATES = "trip_rates_v1";
const RATES_TTL = 1000 * 60 * 60;
const API = "https://api.exchangerate.host";

/* ================= COLORS ================= */

const CATEGORY_COLORS = {
  Transport: "#00eaff",
  Nocleg: "#7b2ff7",
  Jedzenie: "#10b981",
  Atrakcje: "#fb923c",
  Inne: "#f43f5e"
};

/* ================= STATE ================= */

let state = {
  currency: "PLN",
  expenses: [],
  segments: [],
  budgetTarget: 0,
  people: 1
};

/* ================= STORAGE ================= */

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_STATE));
    if (saved) state = { ...state, ...saved };
  } catch {}
}

function saveState() {
  localStorage.setItem(LS_STATE, JSON.stringify(state));
}

/* ================= RATES ================= */

async function getRate(from, to) {
  if (from === to) return 1;

  const key = `${from}_${to}`;
  const cache = JSON.parse(localStorage.getItem(LS_RATES) || "{}");
  const rec = cache[key];

  if (rec && Date.now() - rec.time < RATES_TTL) {
    return rec.rate;
  }

  const res = await fetch(`${API}/convert?from=${from}&to=${to}&amount=1`);
  const data = await res.json();
  const rate = data.result;

  cache[key] = { time: Date.now(), rate };
  localStorage.setItem(LS_RATES, JSON.stringify(cache));

  return rate;
}

/* ================= CURRENCY CHANGE (NEW) ================= */

async function changeCurrency(newCurrency) {
  if (newCurrency === state.currency) return;

  const rate = await getRate(state.currency, newCurrency);
  if (!rate || !isFinite(rate)) {
    alert("Nie można pobrać kursu waluty");
    return;
  }

  /* --- EXPENSES --- */
  state.expenses.forEach(e => {
    e.amount *= rate;
  });

  /* --- SEGMENTS --- */
  state.segments.forEach(s => {
    s.cost *= rate;
  });

  /* --- BUDGET --- */
  state.budgetTarget *= rate;

  state.currency = newCurrency;
  saveState();
  renderAll();
}

/* ================= BUDGET ================= */

function updateBudget(total) {
  const bar = $("budget-progress");
  if (!bar || !state.budgetTarget) {
    bar.style.width = "0%";
    return;
  }

  bar.style.width =
    Math.min(100, (total / state.budgetTarget) * 100) + "%";
}

/* ================= EXPENSES ================= */

function renderExpenses() {
  const list = $("expenses-list");
  list.innerHTML = "";
  let total = 0;

  state.expenses.forEach(e => {
    total += e.amount;
    const color = CATEGORY_COLORS[e.category] || "#64748b";

    const item = document.createElement("div");
    item.className = "item";
    item.style.background = color + "22";
    item.style.borderLeft = `6px solid ${color}`;

    item.innerHTML = `
      <div>
        <strong>${e.name}</strong>
        <div style="font-size:12px">${e.category}</div>
      </div>
      <div>
        ${fmt(e.amount)} ${state.currency}
        <button class="btn ghost" data-del="${e.id}">✕</button>
      </div>
    `;
    list.appendChild(item);
  });

  $("total-amount").textContent = fmt(total);
  $("per-person").textContent = fmt(total / (state.people || 1));
  $("currency-label").textContent = state.currency;

  updateBudget(total);
}

/* ================= CHART ================= */

function drawChart() {
  const canvas = $("chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const size = 240;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const sums = {};
  state.expenses.forEach(e => {
    if (e.amount > 0) {
      sums[e.category] = (sums[e.category] || 0) + e.amount;
    }
  });

  const entries = Object.entries(sums);
  if (!entries.length) return;

  const total = entries.reduce((s, [, v]) => s + v, 0);
  let angle = -Math.PI / 2;

  entries.forEach(([cat, val]) => {
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.arc(size / 2, size / 2, size / 2 - 6, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = CATEGORY_COLORS[cat] || "#64748b";
    ctx.fill();
    angle += slice;
  });
}

/* ================= EVENTS ================= */

function bindEvents() {

  $("add-expense").onclick = () => {
    const name = $("expense-name").value.trim();
    const amount = Number($("expense-amount").value);
    if (!name || amount <= 0) return;

    state.expenses.push({
      id: uid(),
      name,
      category: $("expense-category").value,
      amount
    });

    saveState();
    renderAll();
  };

  $("expenses-list").onclick = e => {
    if (e.target.dataset.del) {
      state.expenses = state.expenses.filter(x => x.id !== e.target.dataset.del);
      saveState();
      renderAll();
    }
  };

  $("budget-target").oninput = e => {
    state.budgetTarget = Number(e.target.value || 0);
    saveState();
    renderAll();
  };

  $("people-count").oninput = e => {
    state.people = Math.max(1, Number(e.target.value || 1));
    saveState();
    renderAll();
  };

  $("currency").onchange = e => changeCurrency(e.target.value);
}

/* ================= INIT ================= */

function renderAll() {
  renderExpenses();
  drawChart();
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  bindEvents();
  renderAll();
  window.addEventListener("resize", drawChart);
});
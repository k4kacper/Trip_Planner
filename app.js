/* =========================================================
   app.js — FINAL WORKING VERSION
   ✔ budget indicator FIXED
   ✔ JSON import / export FIXED
   ✔ currency change FIXED
   ✔ chart + list color sync FIXED
========================================================= */

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = v => Number(v || 0).toFixed(2);

/* ================= CONFIG ================= */

const LS_STATE = "trip_state_v1";

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
  expenses: [],
  days: [],
  segments: [],
  currency: "PLN",
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

/* ================= BUDGET INDICATOR ================= */

function updateBudgetIndicator(total) {
  const bar = $("budget-progress");
  if (!bar) return;

  if (!state.budgetTarget || state.budgetTarget <= 0) {
    bar.style.width = "0%";
    bar.style.background = "linear-gradient(90deg,#00eaff,#7b2ff7)";
    return;
  }

  const percent = Math.min(100, (total / state.budgetTarget) * 100);
  bar.style.width = percent + "%";

  bar.style.background =
    total > state.budgetTarget
      ? "linear-gradient(90deg,#ef4444,#dc2626)"
      : "linear-gradient(90deg,#00eaff,#7b2ff7)";
}

/* ================= EXPENSES ================= */

function renderExpenses() {
  const list = $("expenses-list");
  list.innerHTML = "";

  let total = 0;

  state.expenses.forEach(exp => {
    total += Number(exp.amount);

    const color = CATEGORY_COLORS[exp.category] || "#64748b";

    const item = document.createElement("div");
    item.className = "item";
    item.style.background = color + "22";
    item.style.borderLeft = `6px solid ${color}`;

    item.innerHTML = `
      <div>
        <strong>${exp.name}</strong>
        <div style="font-size:12px">${exp.category}</div>
      </div>
      <div>
        ${fmt(exp.amount)} ${state.currency}
        <button class="btn ghost" data-del="${exp.id}">✕</button>
      </div>
    `;

    list.appendChild(item);
  });

  $("total-amount").textContent = fmt(total);
  $("per-person").textContent = fmt(total / (state.people || 1));
  $("currency-label").textContent = state.currency;

  updateBudgetIndicator(total);
}

/* ================= DONUT CHART ================= */

function drawChart() {
  const canvas = $("chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const size = Math.min(canvas.clientWidth || 220, 240);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const sums = {};
  state.expenses.forEach(e => {
    sums[e.category] = (sums[e.category] || 0) + Number(e.amount);
  });

  const entries = Object.entries(sums);
  if (!entries.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Brak wydatków", size / 2, size / 2);
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  let angle = -Math.PI / 2;

  entries.forEach(([cat, val]) => {
    const slice = (val / total) * Math.PI * 2;
    const color = CATEGORY_COLORS[cat] || "#64748b";

    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.arc(size / 2, size / 2, size / 2 - 12, angle, angle + slice);
    ctx.fillStyle = color;
    ctx.fill();

    const mid = angle + slice / 2;
    const r = size / 2.6;

    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${cat} ${Math.round((val / total) * 100)}%`,
      size / 2 + Math.cos(mid) * r,
      size / 2 + Math.sin(mid) * r
    );

    angle += slice;
  });

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 3.2, 0, Math.PI * 2);
  ctx.fillStyle = "#0b1220";
  ctx.fill();
}

/* ================= JSON ================= */

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "trip-plan.json";
  a.click();
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state = { ...state, ...data };
      saveState();
      renderAll();
    } catch {
      alert("Nieprawidłowy plik JSON");
    }
  };
  reader.readAsText(file);
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
    const id = e.target.dataset.del;
    if (id) {
      state.expenses = state.expenses.filter(x => x.id !== id);
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

  $("currency").onchange = e => {
    state.currency = e.target.value;
    saveState();
    renderAll();
  };

  $("export-json").onclick = exportJSON;

  $("import-json").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = e => importJSON(e.target.files[0]);
    input.click();
  };

  $("export-pdf").onclick = () => {
    setTimeout(() => window.print(), 100);
  };
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
/* =========================================================
   app.js — FULL FINAL VERSION
========================================================= */

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = v => Number(v || 0).toFixed(2);

/* ================= CONFIG ================= */

const LS_STATE = "trip_state_v1";
const LS_CUSTOM = "trip_custom_currencies_v1";
const LS_RATES = "trip_rates_v1";
const RATES_TTL = 1000 * 60 * 60;

const API_MAIN = "https://api.exchangerate.host";
const API_FB = "https://api.frankfurter.app";

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
    Object.assign(state, JSON.parse(localStorage.getItem(LS_STATE)) || {});
  } catch {}
}
function saveState() {
  localStorage.setItem(LS_STATE, JSON.stringify(state));
}

/* ================= CURRENCY ================= */

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP");
  return r.json();
}

function readRates(base) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_RATES) || "{}");
    const rec = all[base];
    if (!rec || Date.now() - rec.t > RATES_TTL) return null;
    return rec.rates;
  } catch { return null; }
}

function writeRates(base, rates) {
  const all = JSON.parse(localStorage.getItem(LS_RATES) || "{}");
  all[base] = { t: Date.now(), rates };
  localStorage.setItem(LS_RATES, JSON.stringify(all));
}

async function convertCurrency(from, to, amount) {
  const cached = readRates(from);
  if (cached && cached[to]) {
    return { rate: cached[to], result: cached[to] * amount };
  }
  try {
    const d = await fetchJSON(`${API_MAIN}/convert?from=${from}&to=${to}&amount=${amount}`);
    const latest = await fetchJSON(`${API_MAIN}/latest?base=${from}`);
    if (latest?.rates) writeRates(from, latest.rates);
    return { rate: d.info.rate, result: d.result };
  } catch {}
  const fb = await fetchJSON(`${API_FB}/latest?from=${from}&to=${to}`);
  writeRates(from, fb.rates);
  return { rate: fb.rates[to], result: fb.rates[to] * amount };
}

/* ================= RENDER: BUDGET ================= */

function renderBudgetIndicator(total) {
  const bar = $("budget-progress");
  if (!bar) return;

  if (!state.budgetTarget) {
    bar.style.width = "0%";
    return;
  }
  const pct = Math.min(100, (total / state.budgetTarget) * 100);
  bar.style.width = pct + "%";
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

  state.expenses.forEach(e => {
    total += Number(e.amount);
    const color = CATEGORY_COLORS[e.category] || "#64748b";

    const d = document.createElement("div");
    d.className = "item";
    d.style.background = color + "22";
    d.style.borderLeft = `6px solid ${color}`;

    d.innerHTML = `
      <div>
        <strong>${e.name}</strong>
        <div style="font-size:12px">${e.category}</div>
      </div>
      <div>
        ${fmt(e.amount)} ${state.currency}
        <button class="btn ghost" data-del="${e.id}">✕</button>
      </div>
    `;
    list.appendChild(d);
  });

  $("total-amount").textContent = fmt(total);
  $("per-person").textContent = fmt(total / (state.people || 1));
  $("currency-label").textContent = state.currency;
  renderBudgetIndicator(total);
}

/* ================= DAYS ================= */

function renderDays() {
  const c = $("days-container");
  c.innerHTML = "";
  state.days.forEach(d => {
    const el = document.createElement("div");
    el.className = "day";
    el.innerHTML = `
      <strong>${d.name}</strong>
      <ul>
        ${d.activities.map(a =>
          `<li>${a.text}
            <button class="btn ghost" data-delact="${d.id}:${a.id}">–</button>
          </li>`).join("")}
      </ul>
      <div class="row">
        <input placeholder="Aktywność" data-act="${d.id}">
        <button class="btn" data-add="${d.id}">Dodaj</button>
        <button class="btn ghost" data-del="${d.id}">Usuń</button>
      </div>`;
    c.appendChild(el);
  });
}

/* ================= ROUTE ================= */

function renderSegments() {
  const l = $("segments-list");
  l.innerHTML = "";
  let total = 0;

  state.segments.forEach(s => {
    total += Number(s.cost);
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML = `
      <div><strong>${s.type}</strong> ${s.from} → ${s.to}</div>
      <div>${fmt(s.cost)} ${state.currency}
        <button class="btn ghost" data-del="${s.id}">✕</button>
      </div>`;
    l.appendChild(d);
  });

  $("route-total").textContent = fmt(total);
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

/* ================= EVENTS ================= */

function bindEvents() {

  $("add-expense").onclick = () => {
    state.expenses.push({
      id: uid(),
      name: $("expense-name").value,
      category: $("expense-category").value,
      amount: Number($("expense-amount").value)
    });
    saveState(); renderAll();
  };

  $("expenses-list").onclick = e => {
    if (e.target.dataset.del) {
      state.expenses = state.expenses.filter(x => x.id !== e.target.dataset.del);
      saveState(); renderAll();
    }
  };

  $("add-day").onclick = () => {
    state.days.push({ id: uid(), name: $("new-day-name").value, activities: [] });
    saveState(); renderAll();
  };

  $("days-container").onclick = e => {
    if (e.target.dataset.add) {
      const id = e.target.dataset.add;
      const i = document.querySelector(`[data-act="${id}"]`);
      state.days.find(d => d.id === id).activities.push({ id: uid(), text: i.value });
    }
    if (e.target.dataset.del) {
      state.days = state.days.filter(d => d.id !== e.target.dataset.del);
    }
    saveState(); renderAll();
  };

  $("add-segment").onclick = () => {
    state.segments.push({
      id: uid(),
      type: $("segment-type").value,
      from: $("segment-from").value,
      to: $("segment-to").value,
      cost: Number($("segment-cost").value)
    });
    saveState(); renderAll();
  };

  $("segments-list").onclick = e => {
    if (e.target.dataset.del) {
      state.segments = state.segments.filter(s => s.id !== e.target.dataset.del);
      saveState(); renderAll();
    }
  };

  $("budget-target").oninput = e => {
    state.budgetTarget = Number(e.target.value || 0);
    saveState(); renderAll();
  };

  $("people-count").oninput = e => {
    state.people = Math.max(1, Number(e.target.value || 1));
    saveState(); renderAll();
  };

  $("export-pdf").onclick = () => setTimeout(() => window.print(), 100);
}

/* ================= INIT ================= */

function renderAll() {
  renderExpenses();
  renderDays();
  renderSegments();
  drawChart();
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  bindEvents();
  renderAll();
  window.addEventListener("resize", drawChart);
});
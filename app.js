/* =========================================================
   app.js — WERSJA POPRAWIONA (pełna)
   ✔ stabilny wykres Canvas (HiDPI + resize)
   ✔ działający eksport PDF (window.print)
   ✔ waluty + własne waluty + konwersja
   ✔ uproszczona struktura (Opcja 1)
========================================================= */

/* ================= HELPERS ================= */

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = v => Number(v || 0).toFixed(2);

/* ================= KONFIG ================= */

const LS_STATE = "trip_state_v1";
const LS_CUSTOM = "trip_custom_currencies_v1";
const LS_RATES = "trip_rates_v1";
const RATES_TTL = 1000 * 60 * 60;

const API_MAIN = "https://api.exchangerate.host";
const API_FB = "https://api.frankfurter.app";

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

/* ================= WALUTY ================= */

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
  } catch {
    return null;
  }
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

async function initCurrencies() {
  const selects = [$("currency"), $("conv-from"), $("conv-to")].filter(Boolean);
  const custom = JSON.parse(localStorage.getItem(LS_CUSTOM) || "[]");

  let symbols = [];
  try {
    const s = await fetchJSON(`${API_MAIN}/symbols`);
    symbols = Object.keys(s.symbols);
  } catch {
    const f = await fetchJSON(`${API_FB}/currencies`);
    symbols = Object.keys(f);
  }

  const all = Array.from(new Set([...custom, ...symbols])).sort();

  selects.forEach(sel => {
    sel.innerHTML = "";
    all.forEach(c => {
      const o = document.createElement("option");
      o.value = o.textContent = c;
      sel.appendChild(o);
    });
  });

  $("currency").value = state.currency;
  $("conv-from").value = state.currency;
  $("conv-to").value = all.includes("USD") ? "USD" : all[0];

  $("add-custom-currency").onclick = () => {
    const code = $("custom-currency").value.trim().toUpperCase();
    if (code.length < 3) return alert("Nieprawidłowy kod waluty");
    if (!custom.includes(code)) {
      custom.unshift(code);
      localStorage.setItem(LS_CUSTOM, JSON.stringify(custom.slice(0, 30)));
    }
    initCurrencies();
    $("custom-currency").value = "";
  };

  $("conv-do").onclick = async () => {
    const amt = Number($("conv-amount").value || 0);
    if (!amt) return;
    $("conv-result").textContent = "…";
    try {
      const r = await convertCurrency($("conv-from").value, $("conv-to").value, amt);
      $("conv-result").textContent = `${fmt(r.result)} ${$("conv-to").value}`;
      $("conv-note").textContent = `Kurs: ${r.rate}`;
    } catch {
      $("conv-result").textContent = "Błąd";
    }
  };

  $("conv-refresh").onclick = initCurrencies;
}

/* ================= RENDER ================= */

function renderExpenses() {
  const list = $("expenses-list");
  list.innerHTML = "";

  const q = $("search-expenses").value.toLowerCase();
  const cat = $("filter-category").value;

  state.expenses
    .filter(e => (!q || e.name.toLowerCase().includes(q)) && (!cat || e.category === cat))
    .forEach(e => {
      const d = document.createElement("div");
      d.className = "item";
      d.innerHTML = `
        <div><strong>${e.name}</strong><div>${e.category}</div></div>
        <div>
          ${fmt(e.amount)} ${state.currency}
          <button class="btn ghost" data-edit="${e.id}">Edytuj</button>
          <button class="btn ghost" data-del="${e.id}">Usuń</button>
        </div>`;
      list.appendChild(d);
    });

  const total = state.expenses.reduce((s, e) => s + Number(e.amount), 0);
  $("total-amount").textContent = fmt(total);
  $("per-person").textContent = fmt(total / (state.people || 1));
  $("currency-label").textContent = state.currency;

  const pct = state.budgetTarget ? Math.min(100, (total / state.budgetTarget) * 100) : 0;
  $("budget-progress").style.width = pct + "%";
}

function renderDays() {
  const c = $("days-container");
  c.innerHTML = "";
  state.days.forEach(d => {
    const el = document.createElement("div");
    el.className = "day";
    el.innerHTML = `
      <strong>${d.name}</strong>
      <ul>${d.activities.map(a =>
        `<li>${a.text} <button class="btn ghost" data-delact="${d.id}:${a.id}">–</button></li>`
      ).join("")}</ul>
      <div class="row">
        <input placeholder="Nowa aktywność" data-actinput="${d.id}">
        <button class="btn" data-addact="${d.id}">Dodaj</button>
        <button class="btn ghost" data-deld="${d.id}">Usuń</button>
      </div>`;
    c.appendChild(el);
  });
}

function renderSegments() {
  const l = $("segments-list");
  l.innerHTML = "";
  state.segments.forEach(s => {
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML = `
      <div><strong>${s.type}</strong> ${s.from} → ${s.to}<div>${s.note || ""}</div></div>
      <div>${fmt(s.cost)} ${state.currency}
        <button class="btn ghost" data-delseg="${s.id}">Usuń</button>
      </div>`;
    l.appendChild(d);
  });

  $("route-total").textContent = fmt(
    state.segments.reduce((s, x) => s + Number(x.cost), 0)
  );
}

/* ================= WYKRES (POPRAWIONY) ================= */

function drawChart() {
  const canvas = $("chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const size = Math.min(canvas.clientWidth || 200, 220);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const sums = {};
  state.expenses.forEach(e => {
    if (e.amount > 0) sums[e.category] = (sums[e.category] || 0) + Number(e.amount);
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

  const colors = ["#00eaff", "#7b2ff7", "#10b981", "#fb923c", "#f43f5e"];

  entries.forEach(([_, v], i) => {
    const slice = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.arc(size / 2, size / 2, size / 2 - 10, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    angle += slice;
  });

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
  ctx.fillStyle = "#0b1220";
  ctx.fill();
}

function renderAll() {
  renderExpenses();
  renderDays();
  renderSegments();
  drawChart();
}

/* ================= EVENTS ================= */

function bindEvents() {
  $("add-expense").onclick = () => {
    const n = $("expense-name").value.trim();
    const a = Number($("expense-amount").value);
    if (!n || a <= 0) return;
    state.expenses.push({ id: uid(), name: n, category: $("expense-category").value, amount: a });
    saveState(); renderAll();
  };

  $("expenses-list").onclick = e => {
    const del = e.target.dataset.del;
    const edit = e.target.dataset.edit;
    if (del) {
      state.expenses = state.expenses.filter(x => x.id !== del);
      saveState(); renderAll();
    }
    if (edit) {
      const ex = state.expenses.find(x => x.id === edit);
      $("modal-name").value = ex.name;
      $("modal-category").value = ex.category;
      $("modal-amount").value = ex.amount;
      $("modal").classList.remove("hidden");
      $("modal-save").onclick = () => {
        ex.name = $("modal-name").value;
        ex.category = $("modal-category").value;
        ex.amount = Number($("modal-amount").value);
        $("modal").classList.add("hidden");
        saveState(); renderAll();
      };
    }
  };

  $("modal-cancel").onclick = () => $("modal").classList.add("hidden");

  $("add-day").onclick = () => {
    state.days.push({ id: uid(), name: $("new-day-name").value || `Dzień ${state.days.length + 1}`, activities: [] });
    saveState(); renderAll();
  };

  $("days-container").onclick = e => {
    const add = e.target.dataset.addact;
    const del = e.target.dataset.deld;
    const da = e.target.dataset.delact;

    if (add) {
      const i = document.querySelector(`[data-actinput="${add}"]`);
      if (!i.value) return;
      const d = state.days.find(x => x.id === add);
      d.activities.push({ id: uid(), text: i.value });
      saveState(); renderAll();
    }
    if (del) {
      state.days = state.days.filter(x => x.id !== del);
      saveState(); renderAll();
    }
    if (da) {
      const [d, a] = da.split(":");
      const day = state.days.find(x => x.id === d);
      day.activities = day.activities.filter(x => x.id !== a);
      saveState(); renderAll();
    }
  };

  $("add-segment").onclick = () => {
    const f = $("segment-from").value.trim();
    const t = $("segment-to").value.trim();
    const c = Number($("segment-cost").value);
    if (!f || !t || c <= 0) return;
    state.segments.push({
      id: uid(),
      type: $("segment-type").value,
      from: f, to: t, cost: c,
      note: $("segment-note").value
    });
    saveState(); renderAll();
  };

  $("segments-list").onclick = e => {
    const id = e.target.dataset.delseg;
    if (id) {
      state.segments = state.segments.filter(x => x.id !== id);
      saveState(); renderAll();
    }
  };

  $("currency").onchange = e => {
    state.currency = e.target.value;
    saveState(); renderAll();
  };

  $("export-json").onclick = () => {
    const b = new Blob([JSON.stringify({ state }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "trip-plan.json";
    a.click();
  };

  $("import-json").onclick = () => {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = "application/json";
    i.onchange = e => {
      const r = new FileReader();
      r.onload = () => {
        try {
          Object.assign(state, JSON.parse(r.result).state);
          saveState(); renderAll();
        } catch {}
      };
      r.readAsText(e.target.files[0]);
    };
    i.click();
  };

  /* ✔ NAPRAWIONY EKSPORT PDF */
  $("export-pdf").onclick = () => {
    setTimeout(() => window.print(), 100);
  };
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", async () => {
  loadState();
  bindEvents();
  await initCurrencies();
  renderAll();
  window.addEventListener("resize", drawChart);
});
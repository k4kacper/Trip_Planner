/* app.js — uproszczony, kompletny, z poprawionym dodawaniem własnych walut i ich konwersją
   - cache kursów (1h)
   - primary: exchangerate.host, fallback: frankfurter.app
   - zapis własnych walut w localStorage (lista), walidacja symboli jeśli możliwe
   - integracja z istniejącymi selectami (#currency, #conv-from, #conv-to)
*/

/* ---------- Helpers & config ---------- */
const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2,9);
const fmt = v => Number(v||0).toFixed(2);

const LS_STATE = 'trip_state_v1';
const LS_CUSTOM_CURRENCIES = 'trip_custom_currencies_v1';
const LS_RATES = 'trip_rates_v1';
const RATES_TTL = 1000 * 60 * 60; // 1h

const API_MAIN = 'https://api.exchangerate.host';
const API_FALLBACK = 'https://api.frankfurter.app';

/* ---------- App state (simple) ---------- */
let state = {
  expenses: [], days: [], segments: [],
  currency: 'PLN', budgetTarget:0, people:1
};

/* ---------- Storage ---------- */
function loadState(){
  try { Object.assign(state, JSON.parse(localStorage.getItem(LS_STATE)) || {}); }
  catch(e){ console.warn('loadState',e); }
}
function saveState(){
  try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch(e){ console.warn('saveState',e); }
}

/* ---------- Fetch helper ---------- */
async function fetchJson(url, opts={}, timeout=10000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {...opts, signal: ctrl.signal});
    clearTimeout(id);
    if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } finally { clearTimeout(id); }
}

/* ---------- Currency utils (symbols + caching rates) ---------- */
async function loadSymbols(){
  // try main symbols endpoint
  try {
    const d = await fetchJson(`${API_MAIN}/symbols`);
    if (d && d.symbols) return Object.keys(d.symbols).sort();
  } catch(e){ /* fallback below */ }
  try {
    const fb = await fetchJson(`${API_FALLBACK}/currencies`);
    if (fb) return Object.keys(fb).sort();
  } catch(e){}
  return ['EUR','USD','PLN','GBP'];
}

function readRatesCache(base){
  try {
    const raw = JSON.parse(localStorage.getItem(LS_RATES) || '{}');
    const rec = raw[base];
    if (!rec) return null;
    if (Date.now() - rec.t > RATES_TTL) return null;
    return rec.rates;
  } catch { return null; }
}
function writeRatesCache(base, rates){
  try {
    const raw = JSON.parse(localStorage.getItem(LS_RATES) || '{}');
    raw[base] = { t: Date.now(), rates };
    localStorage.setItem(LS_RATES, JSON.stringify(raw));
  } catch(e){ console.warn(e); }
}

/* Try convert using exchangerate.host convert endpoint then fallback to frankfurter */
async function convertCurrency(from, to, amount){
  // try cache for base
  const cached = readRatesCache(from);
  if (cached && cached[to] !== undefined){
    const rate = Number(cached[to]);
    return { rate, result: rate * Number(amount), source: 'cache' };
  }

  // primary convert
  try {
    const conv = await fetchJson(`${API_MAIN}/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`, {}, 9000);
    if (conv && conv.result !== undefined){
      // cache latest rates for base if possible
      try {
        const latest = await fetchJson(`${API_MAIN}/latest?base=${encodeURIComponent(from)}`, {}, 9000);
        if (latest && latest.rates) writeRatesCache(from, latest.rates);
      } catch(_) {}
      const rate = conv.info && conv.info.rate ? conv.info.rate : (conv.result / amount);
      return { rate: Number(rate), result: Number(conv.result), source: 'exchangerate.host' };
    }
  } catch(e){ /* proceed to fallback */ }

  // fallback frankfurter
  try {
    const fb = await fetchJson(`${API_FALLBACK}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, 9000);
    if (fb && fb.rates && fb.rates[to]){
      const rate = Number(fb.rates[to]);
      // try to cache (we have rates)
      try {
        writeRatesCache(from, fb.rates);
      } catch(_) {}
      return { rate, result: rate * Number(amount), source: 'frankfurter' };
    }
  } catch(e){ /* fail */ }

  throw new Error('Conversion failed');
}

/* ---------- UI: populate currency selects & manage custom currencies ---------- */
async function initCurrencyUI(){
  const convFrom = $('conv-from'), convTo = $('conv-to'), mainSelect = $('currency');
  if (!convFrom || !convTo) return;

  const symbols = await loadSymbols();
  const savedCustom = JSON.parse(localStorage.getItem(LS_CUSTOM_CURRENCIES) || '[]');
  const merged = Array.from(new Set([...savedCustom, ...symbols])).sort();

  function fill(select){
    select.innerHTML = '';
    merged.forEach(code => {
      const o = document.createElement('option'); o.value = code; o.text = code; select.appendChild(o);
    });
  }

  fill(convFrom); fill(convTo);
  if (mainSelect){
    // ensure main select contains merged codes
    merged.forEach(code => {
      if (![...mainSelect.options].some(o => o.value === code)){
        const o = document.createElement('option'); o.value = code; o.text = code; mainSelect.appendChild(o);
      }
    });
  }

  // set sensible defaults
  convFrom.value = (mainSelect && mainSelect.value) || 'PLN';
  convTo.value = savedCustom[0] || (merged.includes('USD') ? 'USD' : merged[0]);
  $('conv-amount').value = 1;

  // hook add custom currency button
  const addBtn = $('add-custom-currency');
  if (addBtn){
    addBtn.onclick = async () => {
      const code = (($('custom-currency').value||'').trim().toUpperCase());
      if (!code || code.length < 3 || code.length > 5){ alert('Wprowadź poprawny kod waluty (3–5 znaków)'); return; }
      // validate symbol existence via symbols endpoint (best-effort)
      let valid = false;
      try {
        const syms = await loadSymbols();
        valid = syms.includes(code);
      } catch(e){ valid = false; }
      // persist custom
      const cur = JSON.parse(localStorage.getItem(LS_CUSTOM_CURRENCIES) || '[]');
      if (!cur.includes(code)){ cur.unshift(code); localStorage.setItem(LS_CUSTOM_CURRENCIES, JSON.stringify(cur.slice(0,30))); }
      // add to selects if missing
      [convFrom, convTo, mainSelect].forEach(s => {
        if (!s) return;
        if (![...s.options].some(o => o.value === code)){
          const o = document.createElement('option'); o.value = code; o.text = code; s.appendChild(o);
        }
      });
      // if symbol unknown warn user that conversion may fail
      if (!valid) alert('Dodano walutę, ale nie odnaleziono jej w publicznych symbolach — konwersja może być niedostępna.');
      // select as target
      convTo.value = code;
      $('custom-currency').value = '';
    };
  }

  // convert button
  $('conv-do').onclick = async () => {
    const amt = Number($('conv-amount').value || 0);
    const from = convFrom.value, to = convTo.value;
    if (!amt || !from || !to){ $('conv-result').textContent = 'Nieprawidłowe dane'; return; }
    $('conv-result').textContent = 'Ładowanie...';
    try {
      const res = await convertCurrency(from, to, amt);
      $('conv-result').innerHTML = `${fmt(res.result)} <small style="color:#9fbcd9">(${to})</small> <span style="color:#9fbcd9;margin-left:8px">kurs:${res.rate.toFixed(6)}</span>`;
      $('conv-note').textContent = `Źródło: ${res.source}`;
    } catch(err){
      console.warn(err);
      $('conv-result').textContent = 'Błąd pobierania kursu';
      $('conv-note').textContent = '';
    }
  };

  // refresh symbols (repopulate)
  $('conv-refresh').onclick = async () => {
    $('conv-result').textContent = 'Odświeżanie...';
    try {
      const sy = await loadSymbols();
      const cur = JSON.parse(localStorage.getItem(LS_CUSTOM_CURRENCIES) || '[]');
      const merged2 = Array.from(new Set([...cur, ...sy])).sort();
      [convFrom, convTo, mainSelect].forEach(s => {
        if (!s) return;
        s.innerHTML = '';
        merged2.forEach(code => { const o=document.createElement('option'); o.value=code; o.text=code; s.appendChild(o); });
      });
      $('conv-result').textContent = 'Zaktualizowano listę walut';
      setTimeout(()=> $('conv-result').textContent = '', 1600);
    } catch(e){
      $('conv-result').textContent = 'Błąd odświeżania';
    }
  };
}

/* ---------- Renderers (simplified) ---------- */
function renderExpenses(){
  const list = $('expenses-list'); if (!list) return; list.innerHTML = '';
  const q = ($('search-expenses') && $('search-expenses').value.toLowerCase()) || '';
  const fcat = ($('filter-category') && $('filter-category').value) || '';

  state.expenses.filter(e => (!q || e.name.toLowerCase().includes(q)) && (!fcat || e.category === fcat))
    .forEach(e => {
      const div = document.createElement('div'); div.className='item';
      div.innerHTML = `<div><strong>${e.name}</strong><div style="font-size:12px;color:#9fbcd9">${e.category}</div></div>
        <div style="display:flex;gap:8px;align-items:center">${fmt(e.amount)} ${state.currency}
        <button class="btn ghost" data-edit="${e.id}">Edytuj</button><button class="btn ghost" data-del="${e.id}">Usuń</button></div>`;
      list.appendChild(div);
    });

  const total = state.expenses.reduce((s,x)=>s+Number(x.amount),0);
  if ($('total-amount')) $('total-amount').textContent = fmt(total);
  if ($('per-person')) $('per-person').textContent = fmt(total/(state.people||1));
  if ($('currency-label')) $('currency-label').textContent = state.currency;

  const pct = state.budgetTarget>0 ? Math.min(100,(total/state.budgetTarget)*100) : 0;
  if ($('budget-progress')) $('budget-progress').style.width = pct + '%';
}

function renderDays(){
  const cont = $('days-container'); if (!cont) return; cont.innerHTML = '';
  state.days.forEach(d => {
    const el = document.createElement('div'); el.className='day';
    el.innerHTML = `<strong style="color:#7ee3ff">${d.name}</strong>
      <ul style="margin:8px 0 10px 18px">${(d.activities||[]).map(a=>`<li>${a.text} <button class="btn ghost" data-delact="${d.id}:${a.id}">–</button></li>`).join('')}</ul>
      <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px">
        <input placeholder="Nowa aktywność" data-actinput="${d.id}">
        <button class="btn" data-addact="${d.id}">Dodaj</button>
        <button class="btn ghost" data-up="${d.id}">↑</button>
        <button class="btn ghost" data-deld="${d.id}">Usuń</button>
      </div>`;
    cont.appendChild(el);
  });
}

function renderSegments(){
  const list = $('segments-list'); if (!list) return; list.innerHTML='';
  state.segments.forEach(s=>{
    const el=document.createElement('div'); el.className='item';
    el.innerHTML = `<div><strong>${s.type}</strong> ${s.from} → ${s.to}<div style="font-size:12px;color:#9fbcd9">${s.note||''}</div></div>
      <div>${fmt(s.cost)} ${state.currency} <button class="btn ghost" data-delseg="${s.id}">Usuń</button></div>`;
    list.appendChild(el);
  });
  if ($('route-total')) $('route-total').textContent = fmt(state.segments.reduce((s,x)=>s+Number(x.cost),0));
}

function drawDonutSimple(){
  // simplified donut; uses current expense breakdown
  const by = {}; state.expenses.forEach(e=>by[e.category]=(by[e.category]||0)+Number(e.amount));
  const arr = Object.entries(by).map(([k,v])=>({k,v}));
  const c=$('chart'); if (!c) return;
  const ctx=c.getContext('2d'); const w=c.width=200,h=c.height=200;ctx.clearRect(0,0,w,h);
  const total=arr.reduce((s,a)=>s+a.v,0)||1; let start=-Math.PI/2;
  const cols=['#00eaff','#fb923c','#10b981','#6366f1','#f43f5e'];
  arr.forEach((a,i)=>{ const slice=(a.v/total)*Math.PI*2; ctx.beginPath(); ctx.moveTo(w/2,w/2); ctx.arc(w/2,w/2,90,start,start+slice); ctx.closePath(); ctx.fillStyle=cols[i%cols.length]; ctx.fill(); start+=slice; });
  ctx.beginPath(); ctx.fillStyle='#0b1220'; ctx.arc(w/2,w/2,50,0,Math.PI*2); ctx.fill();
}

/* ---------- Wiring: events + init ---------- */
function wire(){
  // expenses add
  $('add-expense').onclick = ()=>{
    const name = $('expense-name').value.trim(), cat = $('expense-category').value, amt = Number($('expense-amount').value||0);
    if (!name || amt<=0) { alert('Wprowadź nazwę i kwotę>0'); return; }
    state.expenses.push({ id: uid(), name, category: cat, amount: amt }); saveState(); renderAll();
    $('expense-name').value=''; $('expense-amount').value='';
  };

  // expenses list actions (delegation)
  $('expenses-list').onclick = e=>{
    const del = e.target.dataset.del, edit = e.target.dataset.edit;
    if (del){ state.expenses = state.expenses.filter(x=>x.id!==del); saveState(); renderAll(); }
    if (edit){
      const ex = state.expenses.find(x=>x.id===edit); if (!ex) return;
      $('modal-name').value = ex.name; $('modal-category').value = ex.category; $('modal-amount').value = ex.amount;
      $('modal').classList.remove('hidden');
      $('modal-save').onclick = ()=>{ ex.name=$('modal-name').value; ex.category=$('modal-category').value; ex.amount=Number($('modal-amount').value); $('modal').classList.add('hidden'); saveState(); renderAll(); };
    }
  };

  $('modal-cancel').onclick = ()=>$('modal').classList.add('hidden');

  // filters
  if ($('search-expenses')) $('search-expenses').oninput = renderAll;
  if ($('filter-category')) $('filter-category').onchange = renderAll;

  // budget & people
  if ($('budget-target')) $('budget-target').oninput = e=>{ state.budgetTarget=Number(e.target.value||0); saveState(); renderAll(); };
  if ($('people-count')) $('people-count').oninput = e=>{ state.people=Math.max(1,Number(e.target.value||1)); saveState(); renderAll(); };

  // days add + delegation
  $('add-day').onclick = ()=>{ state.days.push({ id: uid(), name: $('new-day-name').value || `Dzień ${state.days.length+1}`, activities: [] }); saveState(); renderAll(); $('new-day-name').value=''; };
  $('days-container').onclick = e=>{
    const add = e.target.dataset.addact, deld = e.target.dataset.deld, up = e.target.dataset.up, delact = e.target.dataset.delact;
    if (add){ const inp = document.querySelector(`[data-actinput="${add}"]`); if(!inp) return; const txt = inp.value.trim(); if(!txt) return; const day = state.days.find(d=>d.id===add); day.activities.push({id:uid(),text:txt}); saveState(); renderAll(); }
    if (deld){ state.days = state.days.filter(d=>d.id!==deld); saveState(); renderAll(); }
    if (up){ const i = state.days.findIndex(d=>d.id===up); if(i>0){ [state.days[i-1],state.days[i]]=[state.days[i],state.days[i-1]]; saveState(); renderAll(); } }
    if (delact){ const [did,aid]=delact.split(':'); const day=state.days.find(d=>d.id===did); day.activities=day.activities.filter(a=>a.id!==aid); saveState(); renderAll(); }
  };

  // segments add + delegation
  $('add-segment').onclick = ()=>{ const s=$('segment-type').value,f=$('segment-from').value.trim(),t=$('segment-to').value.trim(),c=Number($('segment-cost').value||0),n=$('segment-note').value.trim(); if(!f||!t||c<=0){alert('Błędne dane');return;} state.segments.push({id:uid(),type:s,from:f,to:t,cost:c,note:n}); saveState(); renderAll(); $('segment-from').value='';$('segment-to').value='';$('segment-cost').value='';$('segment-note').value=''; };
  $('segments-list').onclick = e=>{ const id = e.target.dataset.delseg; if(id){ state.segments = state.segments.filter(s=>s.id!==id); saveState(); renderAll(); } };

  // currency main select
  if ($('currency')) $('currency').onchange = e => { state.currency = e.target.value; saveState(); renderAll(); };

  // export/import JSON
  $('export-json').onclick = ()=>{
    const blob = new Blob([JSON.stringify({state},null,2)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='trip-plan.json'; a.click();
  };
  $('import-json').onclick = ()=>{
    const input=document.createElement('input'); input.type='file'; input.accept='application/json'; input.onchange = e=>{
      const f = e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload = ()=>{ try{ const obj=JSON.parse(r.result); if(obj.state) state = Object.assign({}, state, obj.state); else state = Object.assign({}, state, obj); saveState(); renderAll(); }catch{ alert('Nieprawidłowy plik'); } }; r.readAsText(f);
    }; input.click();
  };

  // PDF export (simple: print main content)
  $("export-pdf").onclick = () => {
  // chwilowa klasa, jeśli chcesz dodatkowej kontroli
  document.body.classList.add("print-mode");

  setTimeout(() => {
    window.print();
    document.body.classList.remove("print-mode");
  }, 100);
};


/* ---------- aggregate render ---------- */
function renderAll(){
  renderExpenses(); renderDays(); renderSegments(); drawDonutSimple();
  drawDonutSimple(); // ensure chart updated
  renderBreakdownNote();
}

/* small helper to update category breakdown text (keeps prior UI) */
function renderBreakdownNote(){
  const container = $('category-breakdown');
  if(!container) return; container.innerHTML = '';
  const by = {}; state.expenses.forEach(e=>by[e.category]=(by[e.category]||0)+Number(e.amount));
  Object.keys(by).forEach(k=>{ const d=document.createElement('div'); d.textContent = `${k}: ${fmt(by[k])} ${state.currency}`; container.appendChild(d); });
}

/* ---------- init ---------- */
async function init(){
  loadState();
  // populate currency UI then wire events
  await initCurrencyUI().catch(()=>{/*ignore*/});
  wire();
  renderAll();
  window.addEventListener('resize', ()=>{ drawDonutSimple(); });
}

document.addEventListener('DOMContentLoaded', init);

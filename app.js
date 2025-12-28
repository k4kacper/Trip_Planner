// --- DOM Elements ---
const dayList = document.getElementById('dayList');
const addDayBtn = document.getElementById('addDayBtn');
const expenseList = document.getElementById('expenseList');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const expenseName = document.getElementById('expenseName');
const expenseAmount = document.getElementById('expenseAmount');
const expenseCategory = document.getElementById('expenseCategory');
const convertBtn = document.getElementById('convertBtn');
const currencyAmount = document.getElementById('currencyAmount');
const currencyFrom = document.getElementById('currencyFrom');
const currencyTo = document.getElementById('currencyTo');
const conversionResult = document.getElementById('conversionResult');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const centerMapBtn = document.getElementById('centerMapBtn');
const expenseChartCtx = document.getElementById('expenseChart').getContext('2d');

// --- Data ---
let tripData = {
  days: [],
  expenses: [],
  mapCenter: [52.2297, 21.0122] // Domyślne centrum mapy (Warszawa)
};
let map;
let markers = [];

// --- Load from localStorage ---
function loadData() {
  const data = localStorage.getItem('tripData');
  if (data) {
    tripData = JSON.parse(data);
    renderDays();
    renderExpenses();
    renderChart();
  }
  initMap();
  animateElements();
}

// --- Save to localStorage ---
function saveData() {
  localStorage.setItem('tripData', JSON.stringify(tripData));
}

// --- Animate Elements (GSAP) ---
function animateElements() {
  gsap.from(".gsap-fade-in", {
    opacity: 0,
    y: 20,
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out"
  });

  // Animacja przycisków
  document.querySelectorAll('.btn-animated').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      gsap.to(btn, { scale: 1.05, duration: 0.2 });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { scale: 1, duration: 0.2 });
    });
  });
}

// --- Render Days ---
function renderDays() {
  dayList.innerHTML = '';
  tripData.days.forEach((day, index) => {
    const dayItem = document.createElement('div');
    dayItem.className = 'day-item gsap-fade-in';
    dayItem.innerHTML = `
      <h3>Dzień ${index + 1}</h3>
      <p>${day.activities || 'Brak aktywności'}</p>
      <p>${day.lat && day.lng ? `📍 ${day.lat.toFixed(4)}, ${day.lng.toFixed(4)}` : ''}</p>
      <button onclick="editDay(${index})" class="btn-animated">Edytuj</button>
      <button onclick="deleteDay(${index})" class="btn-animated">Usuń</button>
    `;
    dayList.appendChild(dayItem);
  });
}

// --- Render Expenses ---
function renderExpenses() {
  expenseList.innerHTML = '';
  tripData.expenses.forEach((expense, index) => {
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item gsap-fade-in';
    expenseItem.innerHTML = `
      <h4>${expense.name}</h4>
      <p>${expense.amount} (${expense.category})</p>
      <button onclick="deleteExpense(${index})" class="btn-animated">Usuń</button>
    `;
    expenseList.appendChild(expenseItem);
  });
  renderChart();
}

// --- Render Chart ---
function renderChart() {
  const categories = {};
  tripData.expenses.forEach(expense => {
    if (!categories[expense.category]) {
      categories[expense.category] = 0;
    }
    categories[expense.category] += parseFloat(expense.amount);
  });

  const labels = Object.keys(categories);
  const data = Object.values(categories);
  const backgroundColors = [
    'rgba(0, 247, 255, 0.7)',
    'rgba(255, 0, 255, 0.7)',
    'rgba(255, 200, 0, 0.7)',
    'rgba(0, 255, 100, 0.7)'
  ];

  new Chart(expenseChartCtx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        }
      }
    }
  });
}

// --- Add Day ---
addDayBtn.addEventListener('click', () => {
  const activities = prompt("Wprowadź aktywności na ten dzień:");
  if (activities) {
    tripData.days.push({ activities });
    saveData();
    renderDays();
  }
});

// --- Add Expense ---
addExpenseBtn.addEventListener('click', () => {
  if (expenseName.value && expenseAmount.value) {
    tripData.expenses.push({
      name: expenseName.value,
      amount: expenseAmount.value,
      category: expenseCategory.value
    });
    saveData();
    renderExpenses();
    expenseName.value = '';
    expenseAmount.value = '';
  }
});

// --- Currency Converter (ExchangeRate-API) ---
async function fetchExchangeRates() {
  try {
    const response = await fetch('https://v6.exchangerate-api.com/v6/YOUR_API_KEY/latest/PLN');
    if (!response.ok) throw new Error("Błąd pobierania kursów walut.");
    return await response.json();
  } catch (error) {
    alert("Nie udało się pobrać kursów walut. Używam kursów domyślnych.");
    return {
      conversion_rates: {
        PLN: 1, EUR: 0.22, USD: 0.24, GBP: 0.20, JPY: 33.5, CHF: 0.22,
        CAD: 0.32, AUD: 0.35, SEK: 2.3, NOK: 2.4, CZK: 5.2, HUF: 80
      }
    };
  }
}

convertBtn.addEventListener('click', async () => {
  const amount = parseFloat(currencyAmount.value);
  const from = currencyFrom.value;
  const to = currencyTo.value;
  const rates = await fetchExchangeRates();
  const result = amount * (rates.conversion_rates[to] / rates.conversion_rates[from]);
  conversionResult.textContent = `${amount} ${from} = ${result.toFixed(2)} ${to}`;
  gsap.from(conversionResult, { opacity: 0, y: 10, duration: 0.3 });
});

// --- Export JSON ---
exportJsonBtn.addEventListener('click', () => {
  const dataStr = JSON.stringify(tripData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const exportFileDefaultName = 'trip-data.json';
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  gsap.from(linkElement, { scale: 0.8, opacity: 0, duration: 0.3 });
});

// --- Export PDF (jsPDF + html2canvas) ---
exportPdfBtn.addEventListener('click', async () => {
  const element = document.querySelector('.app-container');
  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
  const imgWidth = 210;
  const pageHeight = 295;
  const imgHeight = canvas.height * imgWidth / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save('trip-plan.pdf');
  gsap.from(pdf, { opacity: 0, duration: 0.3 });
});

// --- Map (Leaflet) ---
function initMap() {
  if (map) map.remove();
  map = L.map('map').setView(tripData.mapCenter, 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Dodaj markery dla dni z lokalizacją
  tripData.days.forEach(day => {
    if (day.lat && day.lng) {
      const marker = L.marker([day.lat, day.lng]).addTo(map)
        .bindPopup(`<b>Dzień ${tripData.days.indexOf(day) + 1}</b><br>${day.activities}`);
      markers.push(marker);
    }
  });

  // Kliknięcie na mapę dodaje nowy punkt
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const activities = prompt("Wprowadź aktywności dla tego miejsca:");
    if (activities) {
      tripData.days.push({ activities, lat, lng });
      tripData.mapCenter = [lat, lng];
      saveData();
      renderDays();
      const marker = L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>Dzień ${tripData.days.length}</b><br>${activities}`);
      markers.push(marker);
    }
  });
}

// --- Center Map ---
centerMapBtn.addEventListener('click', () => {
  map.setView(tripData.mapCenter, 10);
  gsap.from("#map", { opacity: 0.7, duration: 0.5 });
});

// --- Delete Functions ---
window.deleteDay = function(index) {
  if (tripData.days[index].lat && tripData.days[index].lng) {
    map.removeLayer(markers[index]);
    markers.splice(index, 1);
  }
  tripData.days.splice(index, 1);
  saveData();
  renderDays();
};

window.deleteExpense = function(index) {
  tripData.expenses.splice(index, 1);
  saveData();
  renderExpenses();
};

// --- Init ---
loadData();

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
const expenseChartCtx = document.getElementById('expenseChart').getContext('2d');

// --- Data ---
let tripData = {
  days: [],
  expenses: [],
  mapCenter: [52.2297, 21.0122] // Domyślne centrum mapy (Warszawa)
};

// --- Load from localStorage ---
function loadData() {
  const data = localStorage.getItem('tripData');
  if (data) {
    tripData = JSON.parse(data);
    renderDays();
    renderExpenses();
    renderChart();
    initMap();
  } else {
    initMap();
  }
  gsap.from(".gsap-anim", { opacity: 0, y: 20, duration: 0.8, stagger: 0.2, ease: "power2.out" });
}

// --- Save to localStorage ---
function saveData() {
  localStorage.setItem('tripData', JSON.stringify(tripData));
}

// --- Render Days ---
function renderDays() {
  dayList.innerHTML = '';
  tripData.days.forEach((day, index) => {
    const dayItem = document.createElement('div');
    dayItem.className = 'day-item gsap-anim';
    dayItem.innerHTML = `
      <h3>Dzień ${index + 1}</h3>
      <p>${day.activities || 'Brak aktywności'}</p>
      <button onclick="editDay(${index})">Edytuj</button>
      <button onclick="deleteDay(${index})">Usuń</button>
    `;
    dayList.appendChild(dayItem);
  });
}

// --- Render Expenses ---
function renderExpenses() {
  expenseList.innerHTML = '';
  tripData.expenses.forEach((expense, index) => {
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item gsap-anim';
    expenseItem.innerHTML = `
      <h4>${expense.name}</h4>
      <p>${expense.amount} (${expense.category})</p>
      <button onclick="deleteExpense(${index})">Usuń</button>
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
    const response = await fetch('https://v6.exchangerate-api.com/v6/0850dcfa5ae7acc26979cc76/latest/PLN');
    if (!response.ok) throw new Error("Błąd pobierania kursów walut.");
    return await response.json();
  } catch (error) {
    alert("Nie udało się pobrać kursów walut. Używam kursów domyślnych.");
    return { conversion_rates: { PLN: 1, EUR: 0.22, USD: 0.24, GBP: 0.20 } };
  }
}

convertBtn.addEventListener('click', async () => {
  const amount = parseFloat(currencyAmount.value);
  const from = currencyFrom.value;
  const to = currencyTo.value;
  const rates = await fetchExchangeRates();
  const result = amount * (rates.conversion_rates[to] / rates.conversion_rates[from]);
  conversionResult.textContent = `${amount} ${from} = ${result.toFixed(2)} ${to}`;
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
});

// --- Map (Leaflet) ---
function initMap() {
  const map = L.map('map').setView(tripData.mapCenter, 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Dodaj marker dla każdego dnia, jeśli ma współrzędne
  tripData.days.forEach(day => {
    if (day.lat && day.lng) {
      L.marker([day.lat, day.lng]).addTo(map)
        .bindPopup(`Dzień: ${day.activities}`)
        .openPopup();
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
      map.setView([lat, lng], 10);
      L.marker([lat, lng]).addTo(map)
        .bindPopup(`Dzień: ${activities}`)
        .openPopup();
    }
  });
}

// --- Delete Functions ---
window.deleteDay = function(index) {
  tripData.days.splice(index, 1);
  saveData();
  renderDays();
  initMap(); // Odśwież mapę
};

window.deleteExpense = function(index) {
  tripData.expenses.splice(index, 1);
  saveData();
  renderExpenses();
};

// --- Init ---
loadData();

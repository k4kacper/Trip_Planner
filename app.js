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
const importJsonBtn = document.getElementById('importJsonBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const centerMapBtn = document.getElementById('centerMapBtn');
const expenseChartCtx = document.getElementById('expenseChart').getContext('2d');

// Modal elements
const dayModal = document.getElementById('dayModal');
const closeModal = document.querySelector('.close');
const addActivityBtn = document.getElementById('addActivityBtn');
const saveDayBtn = document.getElementById('saveDayBtn');
const activitiesContainer = document.getElementById('activitiesContainer');
const modalTitle = document.getElementById('modalTitle');
const themeToggle = document.querySelector('.theme-toggle');

// --- Data & State ---
let tripData = {
  days: [],
  expenses: [],
  mapCenter: [52.2297, 21.0122]
};
let map;
let markers = [];
let expenseChart;
let currentEditIndex = -1;
let isEditing = false;

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
  loadTheme();
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
    let activitiesHTML = day.activities.map(act =>
      `<p><b>${act.time || ''}</b> ${act.name} ${act.cost ? `(${act.cost} zł)` : ''}</p>`
    ).join('');
    dayItem.innerHTML = `
      <h3>Dzień ${index + 1}</h3>
      ${activitiesHTML}
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
    'rgba(0, 206, 201, 0.7)',
    'rgba(108, 92, 231, 0.7)',
    'rgba(253, 121, 168, 0.7)',
    'rgba(255, 200, 0, 0.7)',
    'rgba(0, 255, 100, 0.7)',
    'rgba(100, 100, 255, 0.7)'
  ];

  if (expenseChart) {
    expenseChart.destroy();
  }

  expenseChart = new Chart(expenseChartCtx, {
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
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.raw} zł`;
            }
          }
        }
      }
    }
  });
}

// --- Add Day (modal) ---
addDayBtn.addEventListener('click', () => {
  currentEditIndex = -1;
  isEditing = false;
  modalTitle.textContent = "Dodaj dzień i aktywności";
  dayModal.style.display = 'block';
  activitiesContainer.innerHTML = `
    <div class="activity-input">
      <input type="text" placeholder="Nazwa aktywności" class="activity-name">
      <input type="text" placeholder="Godzina (np. 10:00)" class="activity-time">
      <input type="number" placeholder="Koszt (opcjonalnie)" class="activity-cost">
      <button class="remove-activity">Usuń</button>
    </div>
  `;
  activitiesContainer.querySelector('.remove-activity').addEventListener('click', (e) => {
    if (activitiesContainer.children.length > 1) {
      e.target.parentElement.remove();
    } else {
      alert("Musisz mieć przynajmniej jedną aktywność!");
    }
  });
});

// --- Add Activity in Modal ---
addActivityBtn.addEventListener('click', () => {
  const newActivity = document.createElement('div');
  newActivity.className = 'activity-input';
  newActivity.innerHTML = `
    <input type="text" placeholder="Nazwa aktywności" class="activity-name">
    <input type="text" placeholder="Godzina (np. 10:00)" class="activity-time">
    <input type="number" placeholder="Koszt (opcjonalnie)" class="activity-cost">
    <button class="remove-activity">Usuń</button>
  `;
  activitiesContainer.appendChild(newActivity);
  newActivity.querySelector('.remove-activity').addEventListener('click', (e) => {
    if (activitiesContainer.children.length > 1) {
      e.target.parentElement.remove();
    } else {
      alert("Musisz mieć przynajmniej jedną aktywność!");
    }
  });
});

// --- Save Day Handler ---
function saveDayHandler() {
  const activities = [];
  document.querySelectorAll('.activity-input').forEach(input => {
    const name = input.querySelector('.activity-name').value;
    const time = input.querySelector('.activity-time').value;
    const cost = input.querySelector('.activity-cost').value;
    if (name) {
      activities.push({ name, time, cost });
    }
  });

  if (activities.length > 0) {
    if (isEditing) {
      tripData.days[currentEditIndex].activities = activities;
      isEditing = false;
    } else {
      tripData.days.push({ activities });
    }
    saveData();
    renderDays();
    dayModal.style.display = 'none';
  } else {
    alert("Dodaj przynajmniej jedną aktywność!");
  }
}

// --- Edit Day ---
window.editDay = function(index) {
  currentEditIndex = index;
  isEditing = true;
  modalTitle.textContent = "Edytuj dzień i aktywności";
  dayModal.style.display = 'block';
  activitiesContainer.innerHTML = '';
  const day = tripData.days[index];
  day.activities.forEach(act => {
    const activityInput = document.createElement('div');
    activityInput.className = 'activity-input';
    activityInput.innerHTML = `
      <input type="text" placeholder="Nazwa aktywności" class="activity-name" value="${act.name || ''}">
      <input type="text" placeholder="Godzina (np. 10:00)" class="activity-time" value="${act.time || ''}">
      <input type="number" placeholder="Koszt (opcjonalnie)" class="activity-cost" value="${act.cost || ''}">
      <button class="remove-activity">Usuń</button>
    `;
    activitiesContainer.appendChild(activityInput);
    activityInput.querySelector('.remove-activity').addEventListener('click', (e) => {
      if (activitiesContainer.children.length > 1) {
        e.target.parentElement.remove();
      } else {
        alert("Musisz mieć przynajmniej jedną aktywność!");
      }
    });
  });
};

// --- Close Modal ---
closeModal.addEventListener('click', () => {
  dayModal.style.display = 'none';
});

// --- Save Day Button ---
saveDayBtn.addEventListener('click', saveDayHandler);

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

// --- Currency Converter ---
async function fetchExchangeRates() {
  try {
    const response = await fetch('https://v6.exchangerate-api.com/v6/0850dcfa5ae7acc26979cc76/latest/PLN');
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

// --- Import JSON ---
importJsonBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        tripData = importedData;
        saveData();
        renderDays();
        renderExpenses();
        renderChart();
        initMap();
        alert("Dane zaimportowane pomyślnie!");
      } catch (error) {
        alert("Błąd podczas importu pliku JSON. Sprawdź format pliku.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

// --- Export PDF ---
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

  markers = [];
  tripData.days.forEach(day => {
    if (day.lat && day.lng) {
      const marker = L.marker([day.lat, day.lng]).addTo(map)
        .bindPopup(`<b>Dzień ${tripData.days.indexOf(day) + 1}</b><br>${day.activities.map(a => a.name).join('<br>')}`);
      markers.push(marker);
    }
  });

  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const activities = [];
    const name = prompt("Wprowadź nazwę aktywności dla tego miejsca:");
    if (name) {
      const time = prompt("Wprowadź godzinę (np. 10:00):");
      const cost = prompt("Wprowadź koszt (opcjonalnie):");
      activities.push({ name, time, cost });
      tripData.days.push({ activities, lat, lng });
      tripData.mapCenter = [lat, lng];
      saveData();
      renderDays();
      const marker = L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>Dzień ${tripData.days.length}</b><br>${name}`);
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

// --- Theme Management ---
function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.textContent = '🌙';
  } else {
    document.body.classList.remove('light-theme');
    themeToggle.textContent = '☀️';
  }
}

function toggleTheme() {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  themeToggle.textContent = isLight ? '🌙' : '☀️';
  gsap.to("body", {
    duration: 0.4,
    opacity: 0.8,
    onComplete: () => gsap.to("body", { duration: 0.2, opacity: 1 })
  });
}

// --- Init ---
themeToggle.addEventListener('click', toggleTheme);
loadData();

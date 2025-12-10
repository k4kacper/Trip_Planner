# 🌍 Planer Wycieczki — Travel Planner (HTML • CSS • JavaScript)

Elegancka, nowoczesna i w pełni interaktywna aplikacja do planowania wycieczek.  
Projekt oparty wyłącznie na **HTML, CSS i czystym JavaScript** (bez frameworków).  
Motyw **Glass Dark** z neonowymi akcentami i animacjami zapewnia nowoczesny wygląd, a funkcjonalność obejmuje:

- zarządzanie budżetem,
- tworzenie planu podróży dzień po dniu,
- dodawanie trasy (loty / samochód),
- pełnoprawny konwerter walut z API,
- eksport do JSON,
- eksport do PDF (drukowalny układ),
- pełne localStorage,
- obsługę walut niestandardowych,
- wykres wydatków (canvas donut chart),
- dynamiczne animacje i tryb glassmorphism.

---

## 🚀 Funkcje

### 🧾 Budżet Podróży
- Dodawanie wydatków (transport, nocleg, jedzenie, atrakcje, inne).
- Kategorie i filtrowanie.
- Wyszukiwarka wydatków.
- Podsumowanie budżetu + koszt na osobę.
- Postęp budżetu (animowany pasek).
- Wykres kołowy (canvas) ukazujący rozkład wydatków.
- Edycja i usuwanie pozycji.
- Trwały zapis danych dzięki localStorage.

---

### 📅 Plan Wycieczki (Dzień po Dniu)
- Tworzenie dni (Dzień 1, 2, …).
- Dodawanie aktywności do wybranych dni.
- Usuwanie, przesuwanie dni (góra/dół).
- Intuicyjna obsługa listy.

---

### ✈️ Trasa (Lot / Samochód)
- Dodawanie segmentów trasy.
- Koszt każdego odcinka.
- Notatki (np. linia lotnicza, czas).
- Automatyczne sumowanie kosztów.

---

### 💱 Konwerter Walut (API)
- Dane walutowe pobierane online:
  - **exchangerate.host** (główne źródło)
  - **frankfurter.app** (fallback)
- Cache kursów walut (1 godzina).
- Przeliczanie kwoty w obie strony.
- Obsługa własnych walut (dowolny kod, np. "XYZ").

---

### 📄 Eksportowanie i Importowanie
- **Eksport do JSON** z całą strukturą podróży.
- **Import JSON** i automatyczne odtworzenie zapisanych danych.
- **Eksport do PDF** (poprzez „druk” sekcji `<main>`).

---

### 🖥️ Interfejs
- Motyw **Glass Dark + neon + blur**.
- Dynamiczne animacje:
  - fade-in,
  - scale reveal,
  - glow pulse,
  - hover transitions.
- Pełna responsywność na urządzenia mobilne.
- Dedykowane gridy: `.row`, `.row2`, `.row3`, `.row4`, `.row5`.

---

## 🛠️ Technologie

| Technologia | Użycie |
|------------|--------|
| **HTML5** | Struktura aplikacji |
| **CSS3 (Glassmorphism, Animacje)** | Wygląd i responsywność |
| **JavaScript (Vanilla JS)** | Cała logika aplikacji |
| **LocalStorage** | Zapis danych użytkownika |
| **Canvas API** | Wykres wydatków |
| **Exchangerate.host API** | Kursy walut |
| **Frankfurter API** | Fallback kursów walut |
| **window.print()** | Eksport PDF |

---

## 📦 Struktura Projektu


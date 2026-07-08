// Falls back to localhost for local testing; overwritten by CI/CD in production.
const API_BASE = window.API_BASE_URL || "http://localhost:3000";

const eventsList = document.getElementById("events-list");
const bookingSection = document.getElementById("booking-section");
const eventsSection = document.getElementById("events-section");
const bookingForm = document.getElementById("booking-form");
const bookingStatus = document.getElementById("booking-status");

async function loadEvents() {
  try {
    const res = await fetch(`${API_BASE}/events`);
    const data = await res.json();
    renderEvents(data.events || []);
  } catch (err) {
    eventsList.textContent = "Failed to load events. Is the API URL configured?";
    console.error(err);
  }
}

function renderEvents(events) {
  if (!events.length) {
    eventsList.textContent = "No events available right now.";
    return;
  }

  eventsList.innerHTML = "";
  events.forEach((ev) => {
    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
      <h3>${escapeHtml(ev.name)}</h3>
      <p>${escapeHtml(ev.venue)} — ${escapeHtml(ev.date)}</p>
      <p>${ev.availableSeats} / ${ev.totalSeats} seats available</p>
    `;
    const btn = document.createElement("button");
    btn.textContent = ev.availableSeats > 0 ? "Book Now" : "Sold Out";
    btn.disabled = ev.availableSeats <= 0;
    btn.addEventListener("click", () => openBookingForm(ev));
    card.appendChild(btn);
    eventsList.appendChild(card);
  });
}

function openBookingForm(ev) {
  document.getElementById("booking-event-id").value = ev.eventId;
  document.getElementById("booking-event-name").textContent = `${ev.name} — ${ev.venue}`;
  document.getElementById("seats").max = ev.availableSeats;
  bookingStatus.textContent = "";
  eventsSection.classList.add("hidden");
  bookingSection.classList.remove("hidden");
}

document.getElementById("cancel-booking").addEventListener("click", () => {
  bookingSection.classList.add("hidden");
  eventsSection.classList.remove("hidden");
});

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const eventId = document.getElementById("booking-event-id").value;
  const userName = document.getElementById("userName").value;
  const email = document.getElementById("email").value;
  const seats = parseInt(document.getElementById("seats").value, 10);

  bookingStatus.textContent = "Booking...";

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, userName, email, seats }),
    });
    const data = await res.json();

    if (!res.ok) {
      bookingStatus.textContent = `Error: ${data.message}`;
      return;
    }

    bookingStatus.textContent = `Booked! Confirmation ID: ${data.bookingId}`;
    bookingForm.reset();
    setTimeout(() => {
      bookingSection.classList.add("hidden");
      eventsSection.classList.remove("hidden");
      loadEvents();
    }, 2000);
  } catch (err) {
    bookingStatus.textContent = "Booking failed. Please try again.";
    console.error(err);
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadEvents();

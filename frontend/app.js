const API_BASE = window.API_BASE_URL || "http://localhost:3000";

let allEventsCache = [];
let selectedEvent = null;

// ---------- Toast ----------
function toast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (isError ? " error" : "");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

// ---------- Profile (stored locally on this device) ----------
function getProfile() {
  try {
    return JSON.parse(localStorage.getItem("stubbox_profile") || "null");
  } catch {
    return null;
  }
}
function saveProfile(profile) {
  localStorage.setItem("stubbox_profile", JSON.stringify(profile));
}

function loadProfileForm() {
  const p = getProfile();
  if (p) {
    document.getElementById("profileName").value = p.name;
    document.getElementById("profileEmail").value = p.email;
    document.getElementById("profileStatus").textContent = "Profile saved on this device.";
  }
}

document.getElementById("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("profileName").value.trim();
  const email = document.getElementById("profileEmail").value.trim();
  saveProfile({ name, email });
  document.getElementById("profileStatus").textContent = "Saved! Your tickets will now sync to this profile.";
  toast("Profile saved");
});

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll(".tab-btn");
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

function showTab(name) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`tab-${name}`).classList.remove("hidden");
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.getElementById("searchBar").style.display = (name === "home" || name === "events") ? "block" : "none";

  if (name === "tickets") loadMyTickets();
  if (name === "profile") loadProfileForm();
}

// ---------- Category poster styling ----------
function categoryClass(category) {
  const map = { Music: "cat-music", Comedy: "cat-comedy", Conference: "cat-conference", Festival: "cat-festival" };
  return map[category] || "cat-default";
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Rendering ----------
function eventCard(ev, distance) {
  const soldOut = ev.availableSeats <= 0;
  const low = !soldOut && ev.availableSeats <= ev.totalSeats * 0.15;
  const seatsClass = soldOut ? "seats-low" : low ? "seats-low" : "seats-ok";
  const seatsLabel = soldOut ? "Sold out" : `${ev.availableSeats} of ${ev.totalSeats} seats left`;

  const card = document.createElement("div");
  card.className = "event-card";
  card.innerHTML = `
    <div class="poster ${categoryClass(ev.category)}">
      <span class="poster-badge">${escapeHtml(ev.category || "Event")}</span>
      <div class="poster-name">${escapeHtml(ev.name)}</div>
    </div>
    <div class="event-body">
      <div class="event-meta">
        <span>📍 ${escapeHtml(ev.venue)}, ${escapeHtml(ev.city || "")}</span>
        <span>📅 ${formatDate(ev.date)}</span>
        ${distance !== undefined ? `<span>🚗 ${distance.toFixed(1)} km away</span>` : ""}
      </div>
      <div class="seats-line ${seatsClass}">${seatsLabel} · ${formatPrice(ev.priceCents)}/seat</div>
      <button ${soldOut ? "disabled" : ""}>${soldOut ? "Sold Out" : "Book Now"}</button>
    </div>
  `;
  if (!soldOut) {
    card.querySelector("button").addEventListener("click", () => openBooking(ev));
  }
  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderGrid(containerId, events, opts = {}) {
  const el = document.getElementById(containerId);
  if (!events.length) {
    el.textContent = "No events found.";
    return;
  }
  el.innerHTML = "";
  events.forEach((ev) => el.appendChild(eventCard(ev, opts.distances ? opts.distances[ev.eventId] : undefined)));
}

// ---------- Loading events ----------
async function loadEvents() {
  try {
    const res = await fetch(`${API_BASE}/events`);
    const data = await res.json();
    allEventsCache = data.events || [];

    document.getElementById("homeCount").textContent = `${allEventsCache.length} live`;
    document.getElementById("eventsCount").textContent = `${allEventsCache.length} total`;

    renderGrid("homeEvents", allEventsCache.slice(0, 6));
    renderGrid("allEvents", allEventsCache);
  } catch (err) {
    console.error(err);
    document.getElementById("homeEvents").textContent = "Failed to load events.";
    document.getElementById("allEvents").textContent = "Failed to load events.";
  }
}

// ---------- Search ----------
document.getElementById("searchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = !q
    ? allEventsCache
    : allEventsCache.filter((ev) =>
        [ev.name, ev.venue, ev.city, ev.category].some((f) => (f || "").toLowerCase().includes(q))
      );
  renderGrid("homeEvents", filtered.slice(0, 6));
  renderGrid("allEvents", filtered);
});

// ---------- Nearby ----------
document.getElementById("locateBtn").addEventListener("click", () => {
  const status = document.getElementById("nearbyStatus");
  if (!navigator.geolocation) {
    status.textContent = "Geolocation isn't supported on this browser.";
    return;
  }
  status.textContent = "Locating you…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const distances = {};
      const withDistance = allEventsCache
        .filter((ev) => typeof ev.lat === "number" && typeof ev.lng === "number")
        .map((ev) => {
          const d = distanceKm(latitude, longitude, ev.lat, ev.lng);
          distances[ev.eventId] = d;
          return ev;
        })
        .sort((a, b) => distances[a.eventId] - distances[b.eventId]);

      status.textContent = `Showing ${withDistance.length} events sorted by distance.`;
      renderGrid("nearbyEvents", withDistance, { distances });
    },
    (err) => {
      status.textContent = "Couldn't get your location — check browser permissions.";
      console.error(err);
    }
  );
});

// ---------- Booking / Stripe checkout ----------
function openBooking(ev) {
  selectedEvent = ev;
  document.getElementById("bookingEventId").value = ev.eventId;
  document.getElementById("seats").value = 1;
  document.getElementById("seats").max = ev.availableSeats;
  document.getElementById("bookingStatus").textContent = "";

  const poster = document.getElementById("bookingPoster");
  poster.className = `poster-hero ${categoryClass(ev.category)}`;
  poster.innerHTML = `<div class="poster-name">${escapeHtml(ev.name)}</div>`;

  updatePriceLine();

  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  document.getElementById("booking-panel").classList.remove("hidden");
  document.getElementById("searchBar").style.display = "none";
}

document.getElementById("seats").addEventListener("input", updatePriceLine);
function updatePriceLine() {
  if (!selectedEvent) return;
  const seats = parseInt(document.getElementById("seats").value, 10) || 1;
  const total = (selectedEvent.priceCents * seats) / 100;
  document.getElementById("bookingPriceLine").textContent = `Total: $${total.toFixed(2)} for ${seats} seat(s)`;
}

document.getElementById("cancelBooking").addEventListener("click", () => showTab("home"));

document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const profile = getProfile();
  if (!profile || !profile.email) {
    document.getElementById("bookingStatus").textContent = "Save your name and email in Profile first.";
    toast("Set up your profile before booking", true);
    showTab("profile");
    return;
  }

  const eventId = document.getElementById("bookingEventId").value;
  const seats = parseInt(document.getElementById("seats").value, 10);
  const status = document.getElementById("bookingStatus");
  status.textContent = "Redirecting to secure checkout…";

  try {
    const res = await fetch(`${API_BASE}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, userName: profile.name, email: profile.email, seats }),
    });
    const data = await res.json();
    if (!res.ok) {
      status.textContent = `Error: ${data.message}`;
      return;
    }
    window.location.href = data.checkoutUrl;
  } catch (err) {
    status.textContent = "Checkout failed. Please try again.";
    console.error(err);
  }
});

// ---------- My tickets ----------
async function loadMyTickets() {
  const profile = getProfile();
  const status = document.getElementById("ticketsStatus");
  const list = document.getElementById("ticketsList");

  if (!profile || !profile.email) {
    status.textContent = "Save your profile to see your tickets here.";
    list.innerHTML = "";
    return;
  }

  status.textContent = "Loading your tickets…";
  try {
    const res = await fetch(`${API_BASE}/bookings?email=${encodeURIComponent(profile.email)}`);
    const data = await res.json();
    const bookings = data.bookings || [];

    if (!bookings.length) {
      status.textContent = "No tickets booked yet — go find something to see!";
      list.innerHTML = "";
      return;
    }

    status.textContent = `${bookings.length} booking(s)`;
    list.innerHTML = "";
    bookings.forEach((b) => {
      const ev = allEventsCache.find((e) => e.eventId === b.eventId);
      const stub = document.createElement("div");
      stub.className = "ticket-stub";
      stub.innerHTML = `
        <div class="ticket-stub-main">
          <h3>${escapeHtml(ev ? ev.name : "Event")}</h3>
          <p>${b.seats} seat(s) · booked ${formatDate(b.createdAt)}</p>
          <p>${ev ? escapeHtml(ev.venue) + ", " + escapeHtml(ev.city || "") : ""}</p>
        </div>
        <div class="ticket-stub-code">${b.bookingId.slice(0, 8).toUpperCase()}</div>
      `;
      list.appendChild(stub);
    });
  } catch (err) {
    status.textContent = "Failed to load tickets.";
    console.error(err);
  }
}

// ---------- Handle return from Stripe checkout ----------
async function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("booking") === "success") {
    const sessionId = params.get("session_id");
    toast("Payment received — confirming your booking…");
    if (sessionId) {
      for (let i = 0; i < 5; i++) {
        try {
          const res = await fetch(`${API_BASE}/bookings/lookup?session_id=${encodeURIComponent(sessionId)}`);
          if (res.status === 200) {
            toast("Booking confirmed! Check My Tickets.");
            break;
          }
        } catch (err) {
          console.error(err);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    showTab("tickets");
    window.history.replaceState({}, "", window.location.pathname);
  } else if (params.get("booking") === "canceled") {
    toast("Checkout canceled — no charge was made.", true);
    window.history.replaceState({}, "", window.location.pathname);
  }
}

// ---------- Init ----------
loadEvents().then(handleCheckoutReturn);

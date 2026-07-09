/**
 * One-off helper to seed sample events into the Events table.
 * Usage: EVENTS_TABLE=ticket-booking-app-Events node seed.js
 */
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.EVENTS_TABLE;

// lat/lng are real-ish coordinates so the "Nearby" tab has something to sort by.
const sampleEvents = [
  {
    name: "Coldplay Live",
    category: "Music",
    venue: "National Stadium",
    city: "Vijayawada",
    date: "2026-09-12",
    lat: 16.5062,
    lng: 80.648,
    totalSeats: 500,
    availableSeats: 500,
    priceCents: 250000,
  },
  {
    name: "Stand-up Comedy Night",
    category: "Comedy",
    venue: "The Laugh House",
    city: "Vijayawada",
    date: "2026-08-01",
    lat: 16.515,
    lng: 80.633,
    totalSeats: 150,
    availableSeats: 150,
    priceCents: 49900,
  },
  {
    name: "Tech Conf 2026",
    category: "Conference",
    venue: "Convention Center",
    city: "Hyderabad",
    date: "2026-10-05",
    lat: 17.385,
    lng: 78.4867,
    totalSeats: 1000,
    availableSeats: 1000,
    priceCents: 150000,
  },
  {
    name: "Classical Carnatic Evening",
    category: "Music",
    venue: "Tyagaraya Kalakshetram",
    city: "Vijayawada",
    date: "2026-08-20",
    lat: 16.5,
    lng: 80.65,
    totalSeats: 300,
    availableSeats: 300,
    priceCents: 30000,
  },
  {
    name: "Startup Pitch Fest",
    category: "Conference",
    venue: "T-Hub",
    city: "Hyderabad",
    date: "2026-09-28",
    lat: 17.4483,
    lng: 78.3915,
    totalSeats: 400,
    availableSeats: 400,
    priceCents: 99900,
  },
  {
    name: "Street Food & Music Fest",
    category: "Festival",
    venue: "Riverside Grounds",
    city: "Vijayawada",
    date: "2026-08-15",
    lat: 16.51,
    lng: 80.62,
    totalSeats: 800,
    availableSeats: 800,
    priceCents: 19900,
  },
];

(async () => {
  if (!TABLE) {
    console.error("Set EVENTS_TABLE env var first.");
    process.exit(1);
  }
  for (const ev of sampleEvents) {
    const eventId = randomUUID();
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { eventId, ...ev } }));
    console.log(`Seeded event: ${ev.name} (${eventId})`);
  }
  console.log("Done.");
})();

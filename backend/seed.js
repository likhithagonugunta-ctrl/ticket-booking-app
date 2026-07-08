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

const sampleEvents = [
  { name: "Coldplay Live", venue: "National Stadium", date: "2026-09-12", totalSeats: 500, availableSeats: 500 },
  { name: "Stand-up Comedy Night", venue: "The Laugh House", date: "2026-08-01", totalSeats: 150, availableSeats: 150 },
  { name: "Tech Conf 2026", venue: "Convention Center", date: "2026-10-05", totalSeats: 1000, availableSeats: 1000 },
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

const { randomUUID } = require("crypto");
const { TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, response } = require("./db");

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { eventId, userName, email, seats } = body;

    if (!eventId || !userName || !email || !seats || seats < 1) {
      return response(400, {
        message: "eventId, userName, email, and seats (>=1) are required",
      });
    }

    const bookingId = randomUUID();
    const createdAt = new Date().toISOString();

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            // Decrement available seats only if enough are left
            Update: {
              TableName: process.env.EVENTS_TABLE,
              Key: { eventId },
              ConditionExpression: "availableSeats >= :seats",
              UpdateExpression: "SET availableSeats = availableSeats - :seats",
              ExpressionAttributeValues: { ":seats": seats },
            },
          },
          {
            Put: {
              TableName: process.env.BOOKINGS_TABLE,
              Item: { bookingId, eventId, userName, email, seats, createdAt },
            },
          },
        ],
      })
    );

    return response(201, { bookingId, eventId, userName, email, seats, createdAt });
  } catch (err) {
    console.error(err);
    if (err.name === "TransactionCanceledException") {
      return response(409, { message: "Not enough seats available" });
    }
    return response(500, { message: "Failed to create booking", error: err.message });
  }
};

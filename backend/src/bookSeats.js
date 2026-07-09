const { randomUUID } = require("crypto");
const { TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("./db");

/**
 * Atomically decrements event seats and records a paid booking.
 * Throws if not enough seats remain (DynamoDB condition failure).
 */
async function bookSeats({ eventId, userName, email, seats, stripeSessionId, amountPaid }) {
  const bookingId = randomUUID();
  const createdAt = new Date().toISOString();

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
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
            Item: {
              bookingId,
              eventId,
              userName,
              email,
              seats,
              createdAt,
              stripeSessionId,
              amountPaid,
              status: "paid",
            },
          },
        },
      ],
    })
  );

  return { bookingId, eventId, userName, email, seats, createdAt };
}

module.exports = { bookSeats };

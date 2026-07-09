const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, response } = require("./db");

exports.handler = async (event) => {
  try {
    const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
    if (!sessionId) {
      return response(400, { message: "session_id query parameter is required" });
    }

    const result = await ddb.send(
      new ScanCommand({
        TableName: process.env.BOOKINGS_TABLE,
        FilterExpression: "stripeSessionId = :sid",
        ExpressionAttributeValues: { ":sid": sessionId },
      })
    );

    const booking = (result.Items || [])[0];
    if (!booking) {
      // Webhook may not have processed yet - not necessarily an error
      return response(202, { message: "Booking not yet confirmed, try again shortly" });
    }

    return response(200, booking);
  } catch (err) {
    console.error(err);
    return response(500, { message: "Failed to look up booking", error: err.message });
  }
};

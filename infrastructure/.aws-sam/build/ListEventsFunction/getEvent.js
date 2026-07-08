const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, response } = require("./db");

exports.handler = async (event) => {
  try {
    const eventId = event.pathParameters && event.pathParameters.eventId;
    if (!eventId) {
      return response(400, { message: "eventId is required" });
    }

    const result = await ddb.send(
      new GetCommand({
        TableName: process.env.EVENTS_TABLE,
        Key: { eventId },
      })
    );

    if (!result.Item) {
      return response(404, { message: "Event not found" });
    }

    return response(200, result.Item);
  } catch (err) {
    console.error(err);
    return response(500, { message: "Failed to get event", error: err.message });
  }
};

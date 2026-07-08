const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, response } = require("./db");

exports.handler = async () => {
  try {
    const result = await ddb.send(
      new ScanCommand({ TableName: process.env.EVENTS_TABLE })
    );
    return response(200, { events: result.Items || [] });
  } catch (err) {
    console.error(err);
    return response(500, { message: "Failed to list events", error: err.message });
  }
};

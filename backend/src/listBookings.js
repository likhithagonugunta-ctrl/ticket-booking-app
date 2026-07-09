const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, response } = require("./db");

exports.handler = async (event) => {
  try {
    const email = event.queryStringParameters && event.queryStringParameters.email;

    const params = { TableName: process.env.BOOKINGS_TABLE };
    if (email) {
      params.FilterExpression = "email = :email";
      params.ExpressionAttributeValues = { ":email": email };
    }

    const result = await ddb.send(new ScanCommand(params));
    return response(200, { bookings: result.Items || [] });
  } catch (err) {
    console.error(err);
    return response(500, { message: "Failed to list bookings", error: err.message });
  }
};

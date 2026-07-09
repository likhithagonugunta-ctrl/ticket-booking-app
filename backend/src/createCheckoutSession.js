const Stripe = require("stripe");
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, response } = require("./db");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { eventId, userName, email, seats } = body;

    if (!eventId || !userName || !email || !seats || seats < 1) {
      return response(400, {
        message: "eventId, userName, email, and seats (>=1) are required",
      });
    }

    const eventResult = await ddb.send(
      new GetCommand({ TableName: process.env.EVENTS_TABLE, Key: { eventId } })
    );
    const ev = eventResult.Item;

    if (!ev) {
      return response(404, { message: "Event not found" });
    }
    if (ev.availableSeats < seats) {
      return response(409, { message: "Not enough seats available" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: ev.priceCents,
            product_data: { name: `${ev.name} (${ev.venue})` },
          },
          quantity: seats,
        },
      ],
      metadata: { eventId, userName, email, seats: String(seats) },
      success_url: `${process.env.FRONTEND_URL}?booking=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}?booking=canceled`,
    });

    return response(200, { checkoutUrl: session.url });
  } catch (err) {
    console.error(err);
    return response(500, { message: "Failed to start checkout", error: err.message });
  }
};

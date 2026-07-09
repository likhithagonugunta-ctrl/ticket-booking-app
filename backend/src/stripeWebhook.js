const Stripe = require("stripe");
const { bookSeats } = require("./bookSeats");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Note: API Gateway REST APIs pass the raw body through untouched for
// Lambda proxy integrations, which Stripe's signature check requires.
exports.handler = async (event) => {
  const signature = event.headers["Stripe-Signature"] || event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const { eventId, userName, email, seats } = session.metadata;

    try {
      await bookSeats({
        eventId,
        userName,
        email,
        seats: parseInt(seats, 10),
        stripeSessionId: session.id,
        amountPaid: session.amount_total,
      });
    } catch (err) {
      // Payment already succeeded on Stripe's side; log for manual follow-up
      // rather than returning an error (which would cause Stripe to retry
      // and could double-charge the seat check).
      console.error("Booking failed after successful payment:", err);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

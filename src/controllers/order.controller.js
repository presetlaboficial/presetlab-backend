const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { db } = require("../config/firebase");
const { calculateTotal } = require("../services/product.service");

// Inicia a sessão de pagamento
exports.createCheckout = async (req, res) => {
  try {
    const { items, userId } = req.body;
    const total = await calculateTotal(items);

    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "boleto"],
      line_items: items.map((item) => ({
        price_data: {
          currency: "brl",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity || 1,
      })),
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/account/orders/${orderId}`,
      metadata: { orderId, userId },
    });

    await orderRef.set({
      userId,
      items,
      total,
      status: "pendente",
      stripeSessionId: session.id,
      stripeUrl: session.url, 
      createdAt: new Date(),
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lida com a confirmação de pagamento (Webhook)
exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    await db.collection("orders").doc(orderId).update({
      status: "pago",
      paymentMethod: session.payment_method_types[0],
      updatedAt: new Date(),
    });
  }

  res.json({ received: true });
};

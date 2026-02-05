require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require("./service-account.json");
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const adminRoutes = require("./src/routes/admin.routes");
const { calculateTotal } = require("./src/services/product.service");

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        "https://preset-lab.vercel.app",
        "http://localhost:4200",
      ];

      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use("/admin", adminRoutes);

// --- ROTA DE CHECKOUT (Pública) ---
app.post("/create-checkout-session", async (req, res) => {
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
      createdAt: new Date(),
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erro no Checkout:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- WEBHOOK DO STRIPE ---
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
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
      await updateOrderToPaid(session);
    }

    res.json({ received: true });
  },
);

async function updateOrderToPaid(session) {
  const orderId = session.metadata.orderId;
  if (!orderId) return console.log("⚠️ Pedido sem ID no metadata.");

  try {
    await db.collection("orders").doc(orderId).update({
      status: "pago",
      paymentMethod: session.payment_method_types[0],
      updatedAt: new Date(),
    });
    console.log(`✅ Pedido ${orderId} atualizado para PAGO!`);
  } catch (error) {
    console.error("❌ Erro ao atualizar pedido:", error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

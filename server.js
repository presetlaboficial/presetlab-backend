require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const serviceAccount = require("./service-account.json");
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const { checkAdmin } = require("./src/middlewares/auth.middleware");
const { calculateTotal } = require("./src/services/product.service");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));

// Middleware especial para o Webhook do Stripe
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// --- ROTAS PÚBLICAS / CHECKOUT ---

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { items, userId } = req.body;

    // SEGURANÇA: Calcula o total real no backend
    const total = await calculateTotal(items);

    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "boleto"],
      line_items: items.map((item) => ({
        price_data: {
          currency: "brl",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100), // Stripe usa centavos
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
    res.status(500).json({ error: error.message });
  }
});

// --- ROTAS DE ADMIN (Protegidas pelo Middleware) ---

app.post("/admin/products", checkAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("products").add(req.body);
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/admin/products/:id", checkAdmin, async (req, res) => {
  try {
    await db.collection("products").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/admin/products/:id", checkAdmin, async (req, res) => {
  try {
    await db.collection("products").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- WEBHOOK ---
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

app.listen(3000, () => console.log("🚀 Server running on port 3000"));

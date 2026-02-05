require("dotenv").config();
const express = require("express");
const cors = require("cors");

require("./src/config/firebase");
const adminRoutes = require("./src/routes/admin.routes");
const checkoutRoutes = require("./src/routes/checkout.routes");
const orderController = require("./src/controllers/order.controller");

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL,
        "https://preset-lab.vercel.app",
        "http://localhost:4200",
      ];
      if (!origin || allowed.includes(origin.replace(/\/$/, "")))
        callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  orderController.handleWebhook,
);

app.use(express.json());

// Rotas
app.use("/admin", adminRoutes);
app.use("/checkout", checkoutRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { checkAuth } = require("../middlewares/auth.middleware");

router.post("/create-checkout-session", orderController.createCheckout);

router.get(
  "/download/:orderId/:productId",
  checkAuth,
  orderController.getDownloadLink,
);

module.exports = router;

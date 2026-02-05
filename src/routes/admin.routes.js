const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { checkAdmin } = require("../middlewares/auth.middleware");

const db = admin.firestore();

router.use(checkAdmin);

router.post("/products", async (req, res) => {
  try {
    const docRef = await db.collection("products").add(req.body);
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    await db.collection("products").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    await db.collection("products").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

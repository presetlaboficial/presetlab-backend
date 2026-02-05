const admin = require("firebase-admin");

const calculateTotal = async (items) => {
  const db = admin.firestore();

  const productIds = [
    ...new Set(items.map((i) => i.productId).filter((id) => !!id)),
  ];

  if (productIds.length === 0) return 0;

  const productsSnap = await db
    .collection("products")
    .where(admin.firestore.FieldPath.documentId(), "in", productIds)
    .get();

  let total = 0;
  productsSnap.forEach((doc) => {
    const itemInCart = items.find((i) => i.productId === doc.id);
    const priceFromDb = doc.data().price;

    total += Number(priceFromDb) * (Number(itemInCart.quantity) || 1);
  });

  return total;
};

module.exports = { calculateTotal };

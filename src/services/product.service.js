const admin = require("firebase-admin");

const calculateTotal = async (items) => {
  const db = admin.firestore(); 
  
  const productIds = items.map(i => i.id);
  const productsSnap = await db.collection('products')
    .where(admin.firestore.FieldPath.documentId(), 'in', productIds)
    .get();
  
  let total = 0;
  productsSnap.forEach(doc => {
    const itemInCart = items.find(i => i.id === doc.id);
    const priceFromDb = doc.data().price;
    total += priceFromDb * (itemInCart.quantity || 1);
  });
  
  return total;
};

module.exports = { calculateTotal };
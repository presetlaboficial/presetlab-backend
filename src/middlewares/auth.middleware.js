const admin = require("firebase-admin");

const checkAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).send("Unauthorized");

  const token = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    console.log("E-mail do Token:", decodedToken.email, "| Admin Claim:", decodedToken.admin);

    if (decodedToken.admin === true) {
      next();
    } else {
      res.status(403).send("Forbidden: Not an admin");
    }
  } catch (error) {
    res.status(401).send("Invalid Token");
  }
};

module.exports = { checkAdmin };

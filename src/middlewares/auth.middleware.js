const admin = require("firebase-admin");

// Verifica se o usuário está logado
const checkAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
  }
};

// Verifica se o usuário logado tem permissão de Admin
const checkAdmin = async (req, res, next) => {
  await checkAuth(req, res, async () => {
    try {
      if (req.user && req.user.admin === true) {
        next();
      } else {
        res.status(403).json({ error: "Acesso restrito a administradores." });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao verificar permissões." });
    }
  });
};

module.exports = { checkAuth, checkAdmin };
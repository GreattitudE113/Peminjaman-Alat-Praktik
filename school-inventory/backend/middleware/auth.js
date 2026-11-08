function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Silakan login terlebih dahulu." });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Silakan login terlebih dahulu." });
  if (req.session.user.role !== "admin") return res.status(403).json({ message: "Akses khusus admin." });
  next();
}

module.exports = { requireAuth, requireAdmin };

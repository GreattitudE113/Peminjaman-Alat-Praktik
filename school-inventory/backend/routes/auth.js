const router = require("express").Router();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username dan password wajib diisi." });

    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.username, u.password_hash, u.role, u.is_active,
              s.id AS student_id, s.nisn, c.name AS class_name, d.name AS department_name
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN departments d ON d.id = c.department_id
       WHERE u.username = ? LIMIT 1`, [username.trim()]
    );
    const user = rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Username atau password tidak sesuai." });
    }

    req.session.user = {
      id: user.id, full_name: user.full_name, username: user.username, role: user.role,
      student_id: user.student_id || null, nisn: user.nisn || null,
      class_name: user.class_name || null, department_name: user.department_name || null
    };
    await pool.execute("INSERT INTO activity_logs (user_id, action, description) VALUES (?, 'LOGIN', 'Pengguna masuk ke sistem')", [user.id]);
    res.json({ user: req.session.user });
  } catch (err) { next(err); }
});

router.get("/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Belum login." });
  res.json({ user: req.session.user });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("school_inventory.sid");
    res.json({ message: "Berhasil logout." });
  });
});

module.exports = router;

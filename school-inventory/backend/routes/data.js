const router = require("express").Router();
const pool = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const [equipment] = await pool.query("SELECT COUNT(*) total_items, COALESCE(SUM(total_stock),0) total_stock, COALESCE(SUM(available_stock),0) available_stock FROM equipment WHERE is_active=1");
    const [loans] = await pool.query("SELECT COUNT(*) total_loans, SUM(status='pending') pending, SUM(status IN ('approved','borrowed','overdue')) active, SUM(status='overdue' OR (status IN ('approved','borrowed') AND planned_return_date < CURDATE())) overdue FROM loans");
    const [recent] = await pool.query(
      `SELECT l.loan_code, u.full_name, c.name class_name, l.status, l.requested_at
       FROM loans l JOIN students s ON s.id=l.student_id JOIN users u ON u.id=s.user_id
       JOIN classes c ON c.id=s.class_id ORDER BY l.created_at DESC LIMIT 6`
    );
    res.json({ equipment: equipment[0], loans: loans[0], recent });
  } catch (err) { next(err); }
});

router.get("/equipment", requireAuth, async (req, res, next) => {
  try {
    const q = `%${(req.query.q || "").trim()}%`;
    const [rows] = await pool.execute(
      `SELECT e.*, cat.name category_name, d.name department_name
       FROM equipment e JOIN categories cat ON cat.id=e.category_id
       LEFT JOIN departments d ON d.id=e.department_id
       WHERE e.is_active=1 AND (e.name LIKE ? OR e.inventory_code LIKE ? OR cat.name LIKE ?)
       ORDER BY e.name`, [q,q,q]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/equipment", requireAdmin, async (req, res, next) => {
  try {
    const { inventory_code, name, category_id, department_id, description, total_stock, condition_status, storage_location } = req.body;
    const stock = Number(total_stock);
    if (!inventory_code || !name || !category_id || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ message: "Kode, nama, kategori, dan stok yang valid wajib diisi." });
    }
    await pool.execute(
      `INSERT INTO equipment (inventory_code,name,category_id,department_id,description,total_stock,available_stock,condition_status,storage_location)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [inventory_code.trim(),name.trim(),Number(category_id),department_id || null,description || null,stock,stock,condition_status || "baik",storage_location || null]
    );
    await pool.execute("INSERT INTO activity_logs (user_id,action,description) VALUES (?,'CREATE_EQUIPMENT',?)", [req.session.user.id, `Menambahkan barang ${name}`]);
    res.status(201).json({ message: "Barang berhasil ditambahkan." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Kode inventaris sudah digunakan." });
    next(err);
  }
});

router.put("/equipment/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name, category_id, department_id, description, total_stock, condition_status, storage_location } = req.body;
    const [rows] = await pool.execute("SELECT total_stock,available_stock FROM equipment WHERE id=? AND is_active=1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Barang tidak ditemukan." });
    const old = rows[0], newTotal = Number(total_stock);
    if (!Number.isInteger(newTotal) || newTotal < 0 || newTotal < (old.total_stock - old.available_stock)) {
      return res.status(400).json({ message: "Stok total tidak boleh lebih kecil dari jumlah barang yang sedang dipinjam." });
    }
    const newAvailable = newTotal - (old.total_stock - old.available_stock);
    await pool.execute(
      `UPDATE equipment SET name=?,category_id=?,department_id=?,description=?,total_stock=?,available_stock=?,condition_status=?,storage_location=? WHERE id=?`,
      [name,category_id,department_id || null,description || null,newTotal,newAvailable,condition_status,storage_location || null,req.params.id]
    );
    res.json({ message: "Data barang diperbarui." });
  } catch (err) { next(err); }
});

router.delete("/equipment/:id", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT total_stock,available_stock FROM equipment WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Barang tidak ditemukan." });
    if (rows[0].total_stock !== rows[0].available_stock) return res.status(400).json({ message: "Barang sedang dipinjam dan tidak dapat dinonaktifkan." });
    await pool.execute("UPDATE equipment SET is_active=0 WHERE id=?", [req.params.id]);
    res.json({ message: "Barang diarsipkan." });
  } catch (err) { next(err); }
});

router.get("/categories", requireAuth, async (req, res, next) => {
  try { const [rows] = await pool.query("SELECT id,name FROM categories ORDER BY name"); res.json(rows); }
  catch (err) { next(err); }
});

router.get("/departments", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id,name FROM departments ORDER BY name");
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/classes", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT c.id,c.name,c.grade,d.name department_name FROM classes c JOIN departments d ON d.id=c.department_id ORDER BY d.name,c.name");
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/students", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id,s.nisn,u.full_name,u.username,c.name class_name,d.name department_name
       FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id
       JOIN departments d ON d.id=c.department_id ORDER BY u.full_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/loans", requireAuth, async (req, res, next) => {
  try {
    const admin = req.session.user.role === "admin";
    const sql = `SELECT l.id,l.loan_code,l.purpose,l.requested_at,l.planned_return_date,l.status,l.admin_note,
      u.full_name,s.nisn,c.name class_name,d.name department_name,
      GROUP_CONCAT(CONCAT(e.name,' (',ld.quantity,')') SEPARATOR ', ') items
      FROM loans l JOIN students s ON s.id=l.student_id JOIN users u ON u.id=s.user_id
      JOIN classes c ON c.id=s.class_id JOIN departments d ON d.id=c.department_id
      JOIN loan_details ld ON ld.loan_id=l.id JOIN equipment e ON e.id=ld.equipment_id
      ${admin ? "" : "WHERE s.user_id=?"}
      GROUP BY l.id ORDER BY l.created_at DESC`;
    const [rows] = admin ? await pool.query(sql) : await pool.execute(sql, [req.session.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;

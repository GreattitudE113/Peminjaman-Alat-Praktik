const router = require("express").Router();
const pool = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.post("/", requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    if (req.session.user.role !== "student" || !req.session.user.student_id) {
      return res.status(403).json({ message: "Hanya akun siswa yang dapat mengajukan peminjaman." });
    }
    const { purpose, planned_return_date, items } = req.body;
    if (!purpose || !planned_return_date || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "Keperluan, tanggal pengembalian, dan minimal satu barang wajib diisi." });
    }
    const returnDate = new Date(`${planned_return_date}T00:00:00`);
    if (Number.isNaN(returnDate.getTime()) || returnDate < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: "Tanggal pengembalian tidak valid." });
    }

    await conn.beginTransaction();
    const code = `PJM-${Date.now().toString().slice(-9)}`;
    const [loanResult] = await conn.execute(
      "INSERT INTO loans (loan_code,student_id,purpose,planned_return_date) VALUES (?,?,?,?)",
      [code,req.session.user.student_id,purpose,planned_return_date]
    );

    const seen = new Set();
    for (const item of items) {
      const equipmentId = Number(item.equipment_id), quantity = Number(item.quantity);
      if (!Number.isInteger(equipmentId) || !Number.isInteger(quantity) || quantity < 1 || seen.has(equipmentId)) {
        throw new Error("Daftar barang tidak valid atau terdapat barang duplikat.");
      }
      seen.add(equipmentId);
      const [equipment] = await conn.execute("SELECT id,name,available_stock,is_active FROM equipment WHERE id=? FOR UPDATE", [equipmentId]);
      if (!equipment.length || !equipment[0].is_active || equipment[0].available_stock < quantity) {
        throw new Error(`Stok ${equipment[0]?.name || "barang"} tidak mencukupi.`);
      }
      await conn.execute("INSERT INTO loan_details (loan_id,equipment_id,quantity) VALUES (?,?,?)", [loanResult.insertId,equipmentId,quantity]);
    }
    await conn.execute("INSERT INTO activity_logs (user_id,action,description) VALUES (?,'REQUEST_LOAN',?)", [req.session.user.id,`Mengajukan ${code}`]);
    await conn.commit();
    res.status(201).json({ message: "Permintaan berhasil dikirim dan menunggu persetujuan admin.", loan_code: code });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ message: err.message || "Permintaan tidak dapat diproses." });
  } finally { conn.release(); }
});

router.patch("/:id/approve", requireAdmin, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [loans] = await conn.execute("SELECT * FROM loans WHERE id=? FOR UPDATE", [req.params.id]);
    if (!loans.length || loans[0].status !== "pending") throw new Error("Permintaan tidak ditemukan atau sudah diproses.");
    const [details] = await conn.execute("SELECT * FROM loan_details WHERE loan_id=?", [req.params.id]);
    for (const item of details) {
      const [stock] = await conn.execute("SELECT available_stock,name FROM equipment WHERE id=? FOR UPDATE", [item.equipment_id]);
      if (!stock.length || stock[0].available_stock < item.quantity) throw new Error(`Stok ${stock[0]?.name || "barang"} sudah tidak mencukupi.`);
    }
    for (const item of details) {
      await conn.execute("UPDATE equipment SET available_stock=available_stock-? WHERE id=?", [item.quantity,item.equipment_id]);
    }
    await conn.execute("UPDATE loans SET status='borrowed',approved_by=?,approved_at=NOW(),admin_note=? WHERE id=?", [req.session.user.id,req.body.admin_note || null,req.params.id]);
    await conn.execute("INSERT INTO activity_logs (user_id,action,description) VALUES (?,'APPROVE_LOAN',?)", [req.session.user.id,`Menyetujui transaksi ${loans[0].loan_code}`]);
    await conn.commit();
    res.json({ message: "Peminjaman disetujui. Stok telah diperbarui." });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ message: err.message });
  } finally { conn.release(); }
});

router.patch("/:id/reject", requireAdmin, async (req, res) => {
  const [result] = await pool.execute("UPDATE loans SET status='rejected',approved_by=?,approved_at=NOW(),admin_note=? WHERE id=? AND status='pending'",
    [req.session.user.id,req.body.admin_note || null,req.params.id]);
  if (!result.affectedRows) return res.status(400).json({ message: "Permintaan tidak ditemukan atau sudah diproses." });
  res.json({ message: "Permintaan ditolak." });
});

router.patch("/:id/return", requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [loans] = await conn.execute("SELECT * FROM loans WHERE id=? FOR UPDATE", [req.params.id]);
    if (!loans.length || !["borrowed","overdue"].includes(loans[0].status)) throw new Error("Transaksi tidak ditemukan atau bukan peminjaman aktif.");
    const [details] = await conn.execute("SELECT * FROM loan_details WHERE loan_id=?", [req.params.id]);
    for (const item of details) {
      const outstanding = item.quantity - item.returned_quantity;
      if (outstanding > 0) {
        await conn.execute("UPDATE equipment SET available_stock=available_stock+? WHERE id=?", [outstanding,item.equipment_id]);
        await conn.execute("UPDATE loan_details SET returned_quantity=quantity WHERE id=?", [item.id]);
      }
    }
    await conn.execute("INSERT INTO returns (loan_id,received_by,condition_note) VALUES (?,?,?)", [req.params.id,req.session.user.id,req.body.condition_note || null]);
    await conn.execute("UPDATE loans SET status='returned' WHERE id=?", [req.params.id]);
    await conn.execute("INSERT INTO activity_logs (user_id,action,description) VALUES (?,'RETURN_LOAN',?)", [req.session.user.id,`Mencatat pengembalian ${loans[0].loan_code}`]);
    await conn.commit();
    res.json({ message: "Pengembalian berhasil dicatat dan stok dikembalikan." });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ message: err.message });
  } finally { conn.release(); }
});

module.exports = router;

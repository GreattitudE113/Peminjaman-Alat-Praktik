require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./config/db");

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dept] = await conn.execute("INSERT IGNORE INTO departments (name) VALUES ('TKJ'),('RPL'),('DKV'),('Akuntansi'),('Manajemen Perkantoran')");
    const [cat] = await conn.execute("INSERT IGNORE INTO categories (name,description) VALUES ('Jaringan','Perangkat praktik jaringan'),('Komputer','Komputer dan periferal'),('Elektronika','Komponen dan alat elektronika'),('Peralatan Umum','Peralatan praktik umum')");
    const [existing] = await conn.execute("SELECT id FROM users WHERE username='admin' LIMIT 1");
    if (!existing.length) {
      const hash = await bcrypt.hash("Admin123!", 12);
      await conn.execute("INSERT INTO users (full_name,username,password_hash,role) VALUES ('Administrator Sekolah','admin',?,'admin')", [hash]);
    }
    await conn.commit();
    console.log("Seed selesai. Login awal admin: username admin / password Admin123!");
    console.log("Segera ubah password awal sebelum website digunakan sungguhan.");
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); await pool.end(); }
}
seed().catch(e => { console.error(e); process.exit(1); });

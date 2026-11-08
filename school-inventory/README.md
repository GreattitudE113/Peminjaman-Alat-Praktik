# School Inventory

Website sistem informasi peminjaman dan pengembalian alat praktik sekolah.

## Teknologi
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: MySQL
- Session login disimpan di MySQL

## Persiapan
Pastikan Node.js (disarankan versi LTS) dan MySQL sudah terpasang. Jalankan MySQL melalui layanan lokal yang kamu gunakan (misalnya XAMPP).

## Instalasi
1. Ekstrak folder proyek.
2. Buka folder `school-inventory` di VS Code.
3. Buat database dengan mengimpor `database/schema.sql` melalui phpMyAdmin atau MySQL Workbench.
4. Salin `.env.example` menjadi `.env`.
5. Sesuaikan `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, dan `SESSION_SECRET`.
6. Buka terminal pada folder proyek, lalu jalankan:

```bash
npm install
npm run seed
npm start
```

7. Buka `http://localhost:3000`.

## Akun admin awal
- Username: `admin`
- Password: `Admin123!`

Segera ganti password awal sebelum digunakan. Akun awal ini hanya untuk pengembangan lokal.

## Menambahkan siswa
Versi awal ini belum menyediakan halaman administrasi pembuatan akun siswa. Buat akun siswa melalui database dengan password hash bcrypt, lalu hubungkan melalui tabel `students` ke kelas. Pastikan data jurusan dan kelas sudah tersedia di tabel `departments` dan `classes`.

Contoh membuat hash password:
```bash
node -e "require('bcryptjs').hash('PasswordSiswa123!', 12).then(console.log)"
```
Lalu gunakan hash tersebut saat memasukkan data ke tabel `users`.

Contoh data jurusan dan kelas:
```sql
INSERT INTO departments (name) VALUES ('TKJ');
INSERT INTO classes (name, department_id, grade)
SELECT 'XI TKJ 1', id, 'XI' FROM departments WHERE name='TKJ';
```

## Catatan fitur versi awal
- Login dan logout berbasis session.
- Dashboard ringkasan inventaris dan transaksi.
- Admin dapat menambah dan mengedit barang.
- Siswa dapat mengajukan transaksi multi-barang.
- Admin dapat menyetujui/menolak permintaan dan mencatat pengembalian.
- Stok baru berkurang saat disetujui dan kembali saat pengembalian.
- Laporan dapat diunduh sebagai CSV yang dapat dibuka di Excel.

## Sebelum dipakai sungguhan di sekolah
Ini adalah fondasi MVP untuk pengujian lokal, belum siap langsung dipublikasikan ke internet. Tambahkan HTTPS, CSRF protection, pembatasan percobaan login, kebijakan backup, manajemen akun siswa/admin, audit pengubahan stok, dan uji coba bersama petugas sekolah. Lengkapi juga fitur penggantian password dan validasi tanggal di server sesuai SOP sekolah.

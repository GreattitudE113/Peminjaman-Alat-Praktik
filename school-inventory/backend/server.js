require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const helmet = require("helmet");
const path = require("path");
const pool = require("./config/db");
const authRoutes = require("./routes/auth");
const dataRoutes = require("./routes/data");
const loanRoutes = require("./routes/loans");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "school_inventory",
  createDatabaseTable: true
});

app.use(session({
  name: "school_inventory.sid",
  secret: process.env.SESSION_SECRET || "development-secret-change-this",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use("/api/auth", authRoutes);
app.use("/api", dataRoutes);
app.use("/api/loans", loanRoutes);
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Terjadi kesalahan pada server." });
});

pool.query("SELECT 1")
  .then(() => app.listen(port, () => console.log(`School Inventory berjalan di http://localhost:${port}`)))
  .catch(err => {
    console.error("Tidak dapat terhubung ke MySQL:", err.message);
    process.exit(1);
  });

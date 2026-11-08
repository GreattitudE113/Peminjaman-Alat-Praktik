CREATE DATABASE IF NOT EXISTS school_inventory
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_inventory;

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  department_id INT NOT NULL,
  grade VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_class (name, department_id),
  CONSTRAINT fk_classes_department FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','student') NOT NULL DEFAULT 'student',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  nisn VARCHAR(30) NOT NULL UNIQUE,
  class_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL
);

CREATE TABLE IF NOT EXISTS equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category_id INT NOT NULL,
  department_id INT NULL,
  description TEXT NULL,
  photo_url VARCHAR(500) NULL,
  total_stock INT NOT NULL DEFAULT 0,
  available_stock INT NOT NULL DEFAULT 0,
  condition_status ENUM('baik','perlu_perbaikan','rusak') NOT NULL DEFAULT 'baik',
  storage_location VARCHAR(120) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_equipment_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_equipment_department FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT chk_equipment_stock CHECK (total_stock >= 0 AND available_stock >= 0 AND available_stock <= total_stock)
);

CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_code VARCHAR(40) NOT NULL UNIQUE,
  student_id INT NOT NULL,
  purpose TEXT NOT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  planned_return_date DATE NOT NULL,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  status ENUM('pending','approved','rejected','borrowed','returned','overdue') NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_loans_admin FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS loan_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  equipment_id INT NOT NULL,
  quantity INT NOT NULL,
  returned_quantity INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_details_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  CONSTRAINT fk_details_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  CONSTRAINT chk_loan_quantity CHECK (quantity > 0 AND returned_quantity >= 0 AND returned_quantity <= quantity)
);

CREATE TABLE IF NOT EXISTS returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  received_by INT NOT NULL,
  return_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  condition_note TEXT NULL,
  CONSTRAINT fk_returns_loan FOREIGN KEY (loan_id) REFERENCES loans(id),
  CONSTRAINT fk_returns_user FOREIGN KEY (received_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_requested ON loans(requested_at);
CREATE INDEX idx_equipment_name ON equipment(name);

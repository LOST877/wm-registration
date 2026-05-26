-- Таблица гонок
CREATE TABLE races (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATETIME NOT NULL,
  location VARCHAR(255),
  location_link VARCHAR(255),
  iframe_html TEXT NULL,
  description TEXT,
  payment_info TEXT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  registration_open TINYINT(1) NOT NULL DEFAULT 1,
  is_finished TINYINT(1) NOT NULL DEFAULT 0,
  banner_desktop VARCHAR(255) NULL,
  banner_mobile VARCHAR(255) NULL,
  sponsors_json TEXT NULL,
  contacts_json TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица категорий (абстрактные, переиспользуемые)
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связующая таблица (M:M)
CREATE TABLE race_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  race_id INT NOT NULL,
  category_id INT NOT NULL,
  sort_order INT DEFAULT 0,

  UNIQUE KEY unique_race_category (race_id, category_id),
  INDEX idx_race_id (race_id),
  INDEX idx_category_id (category_id),

  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Таблица регистраций (прямая связь с гонками)
CREATE TABLE registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  last_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  birth_date DATE NOT NULL,
  race_id INT NOT NULL,
  race_category_id INT NULL,
  city VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  team VARCHAR(255),
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  payment_amount DECIMAL(10,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_reg_race_participant (race_id, phone, first_name, last_name),
  INDEX idx_race_id (race_id),
  INDEX idx_race_category_id (race_category_id),
  INDEX idx_phone (phone),

  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
  FOREIGN KEY (race_category_id) REFERENCES race_categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Таблица результатов гонки (импорт из CSV хронометража)
CREATE TABLE race_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  race_id INT NOT NULL,
  registration_id INT NULL,
  place INT NOT NULL,
  bib_number INT,
  last_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  city VARCHAR(255),
  birth_year YEAR,
  category VARCHAR(50),
  laps JSON NULL,
  INDEX idx_race_id (race_id),
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Вставка тестового пользователя (логин: admin, пароль: ***)
-- ЗАМЕНИ <ХЭШ_ЗДЕСЬ> на результат выполнения hash.php
INSERT INTO admin_users (username, password, full_name)
VALUES ('admin', '$2y$10$Qck1QijkCgJn9/yWIs.gHe9Wln8SmXPQNrlhAbbTabKPhRT.Cop1y', 'Администратор')
ON DUPLICATE KEY UPDATE username=username;
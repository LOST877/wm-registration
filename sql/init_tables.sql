-- Таблица гонок
CREATE TABLE races (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  location VARCHAR(255),
  location_link VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
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

-- Таблица регистраций (связана с race_categories)
CREATE TABLE registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  last_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  birth_date DATE NOT NULL,
  city VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  team VARCHAR(255),
  race_category_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_reg_participant (phone, first_name, last_name),
  INDEX idx_race_category_id (race_category_id),

  FOREIGN KEY (race_category_id) REFERENCES race_categories(id)
    ON DELETE RESTRICT  -- чтобы не удалять категорию, пока есть регистрации
    ON UPDATE CASCADE
);
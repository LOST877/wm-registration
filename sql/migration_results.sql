-- Миграция: таблица результатов гонки
-- is_finished в races уже добавлен; запустить только CREATE TABLE ниже

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

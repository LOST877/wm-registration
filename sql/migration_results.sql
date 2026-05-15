-- Миграция: добавление флага «гонка завершена» и таблицы результатов
-- Запускать на существующей БД wm_reg

ALTER TABLE races ADD COLUMN is_finished TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE race_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  race_id INT NOT NULL,
  place INT NOT NULL,
  bib_number INT,
  last_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  city VARCHAR(255),
  birth_year YEAR,
  category VARCHAR(50),
  lap_1 VARCHAR(20),
  lap_2 VARCHAR(20),
  lap_3 VARCHAR(20),
  lap_4 VARCHAR(20),
  lap_5 VARCHAR(20),
  INDEX idx_race_id (race_id),
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

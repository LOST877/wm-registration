-- Wheel Masters — миграция v2
-- Расширяет схему БД для поддержки нового дизайна:
-- категории с возрастом/описанием, дистанции в race_categories,
-- тарифная сетка оплаты в races.

-- Категории: возраст и описание
ALTER TABLE categories
  ADD COLUMN age_from    INT NULL AFTER name,
  ADD COLUMN age_to      INT NULL AFTER age_from,
  ADD COLUMN description TEXT NULL AFTER age_to;

-- Связка гонка-категория: дистанция, круги, набор высоты
ALTER TABLE race_categories
  ADD COLUMN distance_km DECIMAL(5,1) NULL AFTER sort_order,
  ADD COLUMN laps        INT NULL     AFTER distance_km,
  ADD COLUMN elevation_m INT NULL     AFTER laps;

-- Гонки: тарифная сетка оплаты
-- Формат JSON: [{"date": "YYYY-MM-DD", "amount": 1000}, ...]
-- Тиры должны быть отсортированы по date ASC.
-- Текущая цена = amount последнего тира где date <= CURDATE().
ALTER TABLE races
  ADD COLUMN payment_tiers JSON NULL AFTER payment_info;

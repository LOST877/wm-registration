-- Миграция: добавить колонки для per-race медиаконтента
ALTER TABLE races
  ADD COLUMN banner_desktop VARCHAR(255) NULL AFTER is_finished,
  ADD COLUMN banner_mobile  VARCHAR(255) NULL AFTER banner_desktop,
  ADD COLUMN sponsors_json  TEXT NULL AFTER banner_mobile,
  ADD COLUMN contacts_json  TEXT NULL AFTER sponsors_json;

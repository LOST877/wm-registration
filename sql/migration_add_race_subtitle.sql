-- Миграция: подзаголовок гонки на главной странице
ALTER TABLE races
  ADD COLUMN subtitle VARCHAR(255) NULL AFTER stage;

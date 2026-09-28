-- Миграция: отдельное согласие на распространение персональных данных
-- (ст. 10.1 152-ФЗ) — публикация в списках участников и протоколах на сайте.
-- Время согласия общее с consent_at: оба согласия даются в одной заявке.
-- Существующие заявки получат consent_publication = 0.

ALTER TABLE registrations
  ADD COLUMN consent_publication TINYINT(1) NOT NULL DEFAULT 0 AFTER consent_at;

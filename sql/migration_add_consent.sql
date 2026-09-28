-- Миграция: согласие на обработку персональных данных (152-ФЗ, issue #18)
-- Факт и время согласия хранятся как доказательство (ст. 9 ч. 3 152-ФЗ).
-- Существующие заявки получат consent_given = 0: согласие у них не собиралось.

ALTER TABLE registrations
  ADD COLUMN consent_given TINYINT(1) NOT NULL DEFAULT 0 AFTER team,
  ADD COLUMN consent_at    DATETIME NULL AFTER consent_given;

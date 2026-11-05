-- Исправление искажённых названий городов (issue #21)
-- Причина: клиент и сервер меняют регистр, но не добавляют пропущенный пробел
-- в составных названиях (например, «СтарыйОскол» → «Старыйоскол»).

-- 1. Диагностика — посмотреть все значения города с количеством:
-- SELECT city, COUNT(*) AS cnt
-- FROM registrations
-- GROUP BY city
-- ORDER BY cnt DESC;

-- 2. Исправление известных искажений (добавляйте новые по результатам диагностики)
UPDATE registrations SET city = 'Старый Оскол'
WHERE LOWER(TRIM(city)) IN ('старыйоскол', 'старыйоскол ', 'старый оскол');

UPDATE registrations SET city = 'Нижний Новгород'
WHERE LOWER(TRIM(city)) IN ('нижнийновгород');

UPDATE registrations SET city = 'Набережные Челны'
WHERE LOWER(TRIM(city)) IN ('набережныечелны');

UPDATE registrations SET city = 'Ростов-на-Дону'
WHERE LOWER(TRIM(city)) IN ('ростовнадону', 'ростов на дону');

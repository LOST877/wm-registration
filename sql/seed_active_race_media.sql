-- Заполнить sponsors_json и contacts_json для текущей активной гонки
-- значениями, которые ранее были захардкожены в index.html.
--
-- Баннеры (banner_desktop / banner_mobile) здесь не задаются:
-- CSS-дефолты (assets/banner.png / assets/banner-mobile.png) продолжают
-- работать как запасной вариант, пока баннеры не загружены через админку.
--
-- Применить: SOURCE sql/seed_active_race_media.sql;
--            или через phpMyAdmin / клиент к нужной БД.

UPDATE races
SET
  sponsors_json = JSON_ARRAY(
    JSON_OBJECT('name', 'VELOKON',     'url', 'https://www.avito.ru/brands/i142051302'),
    JSON_OBJECT('name', 'SPORT VITAL', 'url', 'http://sportvital.ru/')
  ),
  contacts_json = JSON_ARRAY(
    JSON_OBJECT('vk', 'https://vk.com/wm_xc'),
    JSON_OBJECT(
      'role', 'Организаторы',
      'entries', JSON_ARRAY(
        JSON_OBJECT('name', 'Антон',   'phone', '+79805346277'),
        JSON_OBJECT('name', 'Кирилл', 'phone', '+79204043494')
      )
    ),
    JSON_OBJECT(
      'role', 'Реклама и маркетинг',
      'entries', JSON_ARRAY(
        JSON_OBJECT('name', 'Дмитрий', 'phone', '+79036516841')
      )
    )
  )
WHERE is_active = 1;

-- Проверка результата:
SELECT id, name, is_active,
       sponsors_json,
       contacts_json
FROM races
WHERE is_active = 1\G

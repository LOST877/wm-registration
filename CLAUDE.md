# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## О проекте

**Wheel Masters** — сайт для регистрации участников кросс-кантри гонок на велосипедах. Бэкенд на PHP/MySQL, фронтенд на чистом JS/HTML/CSS, без фреймворков.

- Публичный сайт (`index.html` + `script.js`): информация об активной гонке, форма регистрации, список участников
- Админка (`admin/`): управление гонками, редактирование участников, экспорт в CSV
- Бэкенд (`api/`): REST API через PDO/MySQL

## Локальная разработка

**Требования:** Open Server Panel (Windows) с MySQL и Apache.

1. Скопировать файлы в `C:\OpenServer\domains\localhost\wm_race\`
2. Скопировать `.htaccess.example` в `.htaccess` и задать параметры БД
3. Инициализировать базу данных:
   ```sql
   CREATE DATABASE IF NOT EXISTS wm_reg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE wm_reg;
   SOURCE sql/init_tables.sql;
   ```
4. Сайт: `http://localhost/wm_race/`, админка: `http://localhost/wm_race/admin/`
5. Хэш пароля администратора генерировать через `hash.php`, затем вставить в `admin_users`

**Конфиг БД** читается из директив `SetEnv` в `.htaccess` (через `getenv()`), с fallback-значениями в `config/db.php`.

## Архитектура

### Порядок запросов
- `script.js` при загрузке делает запрос к `api/race.php` → затем отдельно к `api/categories.php?race_id={id}` → затем к `api/participants.php?race_id={id}`
- Форма регистрации отправляет JSON на `api/register.php` (POST)
- Админка авторизуется через `api/admin/_auth.php` (только POST, ограничено в `.htaccess`)

### Ключевые ограничения
- **Только одна активная гонка** одновременно (`is_active = 1` в `races`)
- **Проверка дублей** по `(race_id, phone, first_name, last_name)` — в PHP и как уникальный ключ в БД
- **`api/race.php` никогда не возвращает категории** — они всегда загружаются отдельно через `api/categories.php?race_id={id}`
- `email` — обязательное поле; `team` — нет, не делать его обязательным
- `payment_amount` — только для админки, не включать в публичные API-ответы

### Форматирование данных
Форматирование ФИО и города выполняется на сервере в `api/register.php` перед записью в БД:
```php
$firstName = ucfirst(strtolower($data['firstName']));
```
Это предотвращает дубли при разном регистре ввода.

## Стиль кода

- **PHP:** смешанный процедурно-объектный стиль, PDO с `prepare()` для всех запросов, всегда `exit` после `json_encode()`
- **JS:** ES6+, без библиотек, цепочки `fetch().then()`
- **HTML/CSS:** семантический HTML5, без inline-стилей кроме крайней необходимости
- Все ответы API — JSON; формат ошибки: `{"success": false, "error": "..."}` с соответствующим HTTP-статусом

## Безопасность (не обсуждается)

- Только `PDO::prepare()` — никогда не подставлять пользовательский ввод напрямую в SQL
- POST-эндпоинты админки должны проверять CSRF-токен через `hash_equals($_SESSION['csrf_token'], $token)`
- Пароли хранятся через `password_hash()`, проверяются через `password_verify()`
- CSRF-защита запланирована, но ещё не реализована в `api/register.php` (см. `PROJECT_KNOLEDGE.md`)

## Схема базы данных

| Таблица | Назначение |
|---|---|
| `races` | Гонки; только одна может иметь `is_active=1` |
| `categories` | Переиспользуемые категории (М, Ж и т.д.) |
| `race_categories` | Таблица связи M:M с полем `sort_order` |
| `registrations` | Заявки участников; `race_category_id` → `race_categories.id` |
| `admin_users` | Учётные записи администраторов |

## Документация

- `PROJECT_KNOLEDGE.md` — полный справочник по API, схема БД, известные ограничения и SQL для быстрого старта
- При добавлении или изменении API-эндпоинтов обновлять `PROJECT_KNOLEDGE.md`

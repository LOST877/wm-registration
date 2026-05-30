# 🚀 PROJECT_KNOWLEDGE.md  
*Документ обновлён: 2026-04-05 | Версия: v1.1*

---

## 🎯 Назначение проекта  
**Wheel Masters** — публичный сайт для регистрации на кросс-кантри гонки на велосипедах.  
Позволяет:
- Показывать актуальную информацию об активной гонке (название, дата, место, описание)
- Принимать заявки от участников с проверкой дублей (по `race_id`, телефону + ФИО)
- Отображать список зарегистрировавшихся с признаком `is_paid` и суммой оплаты
- Автоматически подставлять данные из БД  
- Админка: управление гонками, редактирование участников, экспорт в CSV  
*Ключевое: админка готова и работает.*

---

## 🛠 Технологический стек  
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), без фреймворков  
- **Backend:** PHP 8.2 (OO + PDO), MySQL 5.7  
- **Хостинг:** TimeWeb (статический IP, HTTPS, Apache)  
- **Локальное окружение:** Open Server Panel  
- **Безопасность:** HTTPS, `password_hash()`, проверка CSRF при обновлении

---

## 📁 Структура проекта  
```
/ (корень, как на TimeWeb, так и в репозитории)
├── index.html                      # Главная страница
├── style.css                       # Основные стили сайта
├── script.js                       # Логика: загрузка гонки, категорий, участников, регистрация
├── assets/
│   ├── wm_logo.png                 # Логотип
│   ├── banner.png                  # Десктопный баннер (Hero)
│   └── banner-mobile.png           # Мобильный баннер (Hero)
├── api/
│   ├── race.php                    # GET: гонка по ?race_id=N или активная (без параметра)
│   ├── races.php                   # GET: список всех гонок (публичный)
│   ├── categories.php              # GET: категории по race_id
│   ├── participants.php            # GET: список участников текущей гонки
│   ├── register.php                # POST: регистрация (проверка дублей, форматирование)
│   ├── admin/                      # ✅ Готово (авторизация, управление)
│   │   ├── _auth.php               # POST: авторизация
│   │   ├── races.php               # GET: список гонок
│   │   ├── dashboard.php           # GET: панель администратора
│   │   └── participant/
│   │       ├── get.php             # GET: данные участника
│   │       └── update.php          # POST: обновление участника
├── config/
│   └── db.php                      # Конфиг БД (env-переменные)
├── sql/
│   └── init_tables.sql             # Создание таблиц БД
├── admin/
│   ├── index.html                  # Интерфейс админки
│   ├── admin.css                   # Стили админки
│   └── admin.js                    # Логика админки
├── hash.php                        # Генерация хеша пароля
└── PROJECT_KNOLEDGE.md             # Этот файл
```

---

## 🗄 Схема базы данных (MySQL `wm_reg`)

### Таблицы:
| Таблица | Описание |
|---------|----------|
| `races` | Гонки (id, name, date, location, location_link, iframe_html, description, payment_info, **payment_tiers JSON**, is_active, created_at) |
| `categories` | Категории (id, name, **age_from INT**, **age_to INT**, **description TEXT**, created_at) |
| `race_categories` | Связь N:M (id, race_id, category_id, sort_order, **distance_km DECIMAL**, **laps INT**, **elevation_m INT**) |
| `registrations` | Заявки (id, last_name, first_name, middle_name, birth_date, race_id, race_category_id, phone, email, city, team, is_paid, payment_amount, created_at) |
| `admin_users` | Администраторы (id, username, password (hash), full_name, created_at) |

> Миграция v2: `sql/migrate_v2.sql`

### Важные правила:
- Активной может быть **только одна гонка** (`is_active = 1`)
- Уникальность для регистрации: **`(race_id, phone, first_name, last_name)`** — запрет на дубли
- Категории можно переиспользовать между гонками через `race_categories`
- Сортировка категорий: по `sort_order` в `race_categories` (по умолчанию `0`)
- `is_paid` (TINYINT) — флаг оплаты: `0` или `1`
- `payment_amount` (DECIMAL(10,2), NULL) — сумма оплаты (в админке)
- `payment_info` (TEXT) — описание способа оплаты в формате markdown
- `payment_tiers` (JSON, NULL) — тарифная сетка: `[{"date":"YYYY-MM-DD","amount":1000},...]`; текущая цена = последний тир где `date <= today`
- `age_from`/`age_to` (INT, NULL) — возрастной диапазон категории; `age_to = NULL` означает «без верхней границы»
- `distance_km` (DECIMAL(5,1), NULL), `laps` (INT, NULL), `elevation_m` (INT, NULL) — параметры дистанции per race_category
- Поле `email` — **обязательное** (`NOT NULL`)

---

## 🌐 API Endpoint'ы

### 1. `GET api/race.php`  
**Описание:** Возвращает активную гонку **без категорий** — категории загружаются отдельно  
**Пример ответа:**  
```json
{
  "id": 1,
  "name": "Весенний Лайт",
  "date": "2026-05-16",
  "location": "г.Воронеж, лес за СОК \"Олимпик\"",
  "location_link": "https://yandex.ru/maps/-/CPFvIN43",
  "description": "Лайтовая трасса с офигенным флоу...",
  "payment_info": "Оплата 1000 руб. на сайт"
}
```
**Ошибки:**  
- `404` — нет активных гонок  
- `500` — ошибка сервера  

> **Важно:** Категории загружаются через `GET api/categories.php?race_id={id}` — это разделение оптимизирует load.

---

### 2. `GET api/categories.php?race_id=1`  
**Описание:** Возвращает категории для конкретной гонки  
**Пример ответа:**  
```json
[
  { "id": 1, "name": "М", "sort_order": 0 },
  { "id": 2, "name": "Ж", "sort_order": 0 }
]
```

---

### 3. `GET api/participants.php?race_id=1`  
**Описание:** Возвращает список участников текущей гонки  
**Пример ответа:**  
```json
[
  {
    "id": 42,
    "last_name": "Иванов",
    "first_name": "Иван",
    "middle_name": "Иванович",
    "birth_date": "2000-01-01",
    "city": "Воронеж",
    "phone": "+7 (999) 000-00-00",
    "email": "mail@example.com",
    "team": "Воронеж Team",
    "category": "М",
    "is_paid": 1
  }
]
```

---

### 4. `POST api/register.php`  
**Описание:** Регистрация участника  
**Тело запроса (JSON):**  
```json
{
  "lastName": "иванов",
  "firstName": "ИВАН",
  "middleName": "иванович",
  "birthDate": "2000-01-01",
  "city": "воронеж",
  "phone": "+7 (999) 000-00-00",
  "email": "mail@example.com",
  "team": "Воронеж Team",
  "race_category_id": 1,
  "race_id": 1
}
```

**Проверки:**  
- Уникальность `(race_id, phone, first_name, last_name)`  
- Активность гонки  
- Форматирование ФИО и города на сервере  

**Пример ответа:**  
- `200 OK`: `{"success": true, "message": "Registration successful", "id": 42}`  
- `409 Conflict`: `{"success": false, "error": "Duplicate registration"}`  
- `400/404/500`: `{"success": false, "error": "..."}`  

### 5. `POST api/admin/race_category.php` *(требует сессию)*
**Описание:** Управление категориями конкретной гонки — добавление, удаление, изменение порядка.

**Действие `add`:**
```json
{ "action": "add", "race_id": 1, "name": "Ю16" }
```
Ответ: `{"success": true, "race_category_id": 17, "category_id": 5, "category_name": "Ю16", "sort_order": 3}`  
- Категория создаётся глобально если не существует (`INSERT IGNORE`), затем привязывается к гонке  
- `409` — категория уже привязана к этой гонке  

**Действие `remove`:**
```json
{ "action": "remove", "race_category_id": 17, "confirmed": false }
```
- Если есть участники с этой категорией и `confirmed` не `true`: возвращает `{"success": false, "warn": true, "affected_count": 4}`  
- После подтверждения (`confirmed: true`) — удаляет, FK `ON DELETE SET NULL` обнуляет `registrations.race_category_id`  

**Действие `reorder`:**
```json
{ "action": "reorder", "race_id": 1, "ordered_ids": [17, 12, 9] }
```
Устанавливает `sort_order = index + 1` для каждого ID. Проверяет что все ID принадлежат указанной гонке.

---

### 6. `GET api/admin/export_csv.php?race_id=1` *(требует сессию)*
**Описание:** Скачивает список участников гонки в формате CSV (UTF-8 с BOM, разделитель `;`).  
**Колонки:** Фамилия, Имя, Отчество, Дата рождения (DD.MM.YYYY), Категория  
**Ответ:** Файл `participants_race_{id}_{date}.csv`  
- `400` — не передан `race_id`  
- `401` — не авторизован  
- `404` — гонка не найдена  

> Используется для дальнейшей загрузки в программу отсечки.

---

## 🔐 Безопасность

### Текущие меры:
- ✅ HTTPS (обязательно для передачи чувствительных данных)
- ✅ `password_hash()` и `password_verify()` для хранения паролей (в админке)
- ✅ Форматирование ФИО и города на клиенте и сервере
- ✅ `PDO::prepare()` для предотвращения SQL-инъекций
- ✅ Проверка CSRF-токена в админке через `hash_equals()`

### Внедрение CSRF-защиты:
- Генерировать `csrf_token` при загрузке страницы (`<input type="hidden" name="csrf_token" ...>` или через `<meta>`)
- Проверять его в `api/register.php` и админке
- Пример:
  ```php
  // Генерация
  $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

  // Проверка
  if (!hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
    http_response_code(403);
    exit;
  }
  ```

---

## 🚀 Быстрый старт (для ИИ-агентов)

### 1. Развертывание локально:
- Установить Open Server Panel
- Скопировать файлы в `C:\OpenServer\domains\localhost\wm_race\`
- В `config/db.php` — убедиться, что переменные окружения заданы: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- По умолчанию: `$host = '127.0.1.29'; $port = 3306; $username = 'root'; $password = ''`

### 2. Настройка БД (`wm_reg`):
Выполнить в `phpMyAdmin`:
```sql
CREATE DATABASE IF NOT EXISTS wm_reg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wm_reg;

-- Выполнить sql/init_tables.sql
source sql/init_tables.sql;
```

### 3. Создание тестовой гонки:
```sql
INSERT INTO races (name, date, location, location_link, description, payment_info, is_active)
VALUES ('Весенний Лайт', '2026-05-16', 'г.Воронеж, лес за СОК "Олимпик"', 
        'https://yandex.ru/maps/-/CPFvIN43', 
        'Лайтовая трасса с офигенным флоу...',
        'Оплата 1000 руб. на сайт', TRUE);

-- Вставка категорий и связей
INSERT INTO categories (name) VALUES ('М'), ('Ж'), ('Ю'), ('Д'), ('Дети');
INSERT INTO race_categories (race_id, category_id, sort_order) 
VALUES (1, 1, 1), (1, 2, 2), (1, 3, 3), (1, 4, 4), (1, 5, 5);
```

### 4. Проверка:
- Откройте `http://localhost/wm_race/` — должна отобразиться гонка, категории подгружаются отдельно
- Отправьте тестовую регистрацию — проверьте таблицу `registrations`
- Админка: `http://localhost/wm_race/admin/` — авторизоваться логином `admin`, пароль сгенерировать через `hash.php`

---

## 🧠 Известные ограничения

| Функция | Статус | Комментарий |
|--------|--------|-------------|
| Админка | ✅ Готова | Полностью реализована: `admin/`, `api/admin/`, авторизация через `_auth.php` |
| Колонка `payment_amount` | ✅ Добавлена | Выводится только в админке, не в API публичных страниц |
| CSFR-защита | ⚠️ Запланирована | Требует `csrf_token` в forms и проверки через `hash_equals()` |
| Личный кабинет | ⏳ В планах | Требует `users` + `user_sessions` таблицы |
| Загрузка аватаров | ⏳ В планах | Требует `uploads/` и `move_uploaded_file()` |
| Экспорт в CSV | ✅ В админке | Реализован через `fputcsv()` |
| Переименование категории | ❌ Блокировано | Если категория используется в гонках — нельзя |
| `api/race.php` возвращает категории | ❌ Нет | Категории грузятся отдельно: `api/categories.php?race_id={id}` |
| Управление категориями гонки | ✅ Готово | `api/admin/race_category.php` — add/remove/reorder; UI в модальном окне гонки |

---

## 📦 Дополнительно

### Как добавить новую гонку:
1. Создать запись в `races`
2. Создать/найти категории в `categories`
3. Добавить связи в `race_categories`
4. (Опционально) Установить `is_active = 1` для новой гонки — старая автоматически деактивируется

### Как изменить категорию:
- Если **не используется** — просто обновить в `categories.name`
- Если **используется** — создать новую категорию и обновить связи в `registrations.race_category_id` (через админку)

### Как редактировать участника в админке:
- В админке откроется попап редактирования
- Колонка **"Действия"** находится **первым столбцом** в таблице участников
- Проверка CSRF-токена обязательна для всех изменений

---

**Контакт для вопросов:**  
Разработчик: Wheel Masters Team  
Последнее обновление: 2026-04-05  
Версия: v1.0 (обновлён статус админки, добавлены `payment_info`, `is_paid`, исправлены API-описания)
Версия: v1.1 (добавлена колонка `payment_amount`, перенесена колонка "Действия" в начало таблицы, обновлены API-ограничения)
Версия: v1.2 (добавлен `GET api/admin/export_csv.php` — выгрузка участников в CSV для программы отсечки)
---
name: Правила для AI-агентов (Wheel Masters)
---

**Обновлено:** 2026-04-05 | **Версия:** v0.9  
**Проект:** [Wheel Masters](./PROJECT_KNOWLEDGE.md) — публичный сайт для кросс-кантри гонок.

---

## 🎯 Общие принципы

1. **Сначала читай существующий код и документацию.**  
   Перед любыми изменениями — изучи `PROJECT_KNOWLEDGE.md`, структуру папок, API и БД.

2. **Пиши в стиле проекта:**
   - PHP: **чистый, процедурно-объектный**, без фреймворков (OO + PDO)
   - JS: ES6+, без зависимостей, понятные имена функций
   - HTML/CSS: семантический HTML5 + inline-стили только при крайней необходимости

3. **Строго избегай изменений:**
   - Безопасности (`password_hash`, `PDO::prepare`, HTTPS, проверки CSRF/уникальности)
   - Формата ФИО и города (`ucfirst(strtolower(...))`)
   - Структуры БД без предварительного согласования

---

## 🧩 Работа с API и данными

4. **Проверяй наличие и тип данных перед обработкой.**  
   Пример (PHP):
   ```php
   if (!isset($_GET['race_id']) || !is_numeric($_GET['race_id'])) {
       http_response_code(400);
       echo json_encode(['error' => 'Missing or invalid race_id']);
       exit;
   }
   ```

5. **Дубли всегда проверяй по `(phone, first_name, last_name)`**, не только по телефону.

6. **Перед вставкой в БД — форматируй строки на сервере:**
   ```php
   $firstName = ucfirst(strtolower($_POST['firstName']));
   $lastName  = ucfirst(strtolower($_POST['lastName']));
   $city      = ucfirst(strtolower($_POST['city']));
   ```

7. **Каждый ответ API — JSON.**
   - `200 OK`: `{"success": true, "message": "..."}`
   - `409 Conflict`: `{"success": false, "message": "Дубль..."}`  
   - `404`: `{"error": "Гонка не найдена"}`  
   - `500`: `{"error": "Ошибка сервера"}`

---

## 🔐 Безопасность — не обсуждается

8. **Всегда используй `PDO::prepare()` для любых SQL-запросов.**
9. **Всегда проверяй CSRF-токен в `POST`-запросах (в `api/register.php`).**  
   Пример:
   ```php
   session_start();
   if (!hash_exists($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'])) {
       http_response_code(403);
       exit;
   }
   ```
   *(Для генерации токена в `index.html`: добавь `<script>document.querySelector('form').addEventListener('submit', e => { ... })</script>` или подобный клиентский JS. Но лучше — через `<meta name="csrf_token" content="...">` и JS-вставку в форму.)*

10. **Никогда не используй `$_POST`, `$_GET`, `$_REQUEST` напрямую в SQL — только через prepare.**

---

## 📦 Файлы и структура

11. **Пиши код в соответствии с дерикторией:**
   - `api/*.php` — только API-логика (REST + PDO), **без HTML**
   - `script.js` — логика HTML-страницы (загрузка гонки, форма, список участников)
   - `style.css` — только CSS (без JS и HTML)
   - `assets/` — только файлы (`*.webp`, `*.png`, `*.jpg`)

12. **Не добавляй новых папок без согласования.**

---

## 📚 Комментарии и документация

13. **Комментируй сложные или нетривиальные участки.**
   Пример:
   ```php
   // Форматирование ФИО — чтобы дубли по разному написанному ФИО не пропускались
   $firstName = ucfirst(strtolower($_POST['firstName']));
   ```

14. **При добавлении API-эндпоинта — обнови `PROJECT_KNOWLEDGE.md` (даже черновик).**

---

## 🧪 Тестирование

15. **Перед отправкой — проверь на Open Server Panel:**
   - Отправка формы → ошибка 409 (если дубль)  
   - Несуществующая `race_id` → 404  
   - Пустой `firstName`/`lastName` → 200 OK или 400? (Согласовано: **принимать, но не сохранять**, если `NULL` — пока оставляем как есть, так как на фронте валидация)

---

## ⏳ Известные ограничения (обязательно знать!)

16. **Админка не работает → не пытайся вносить в неё изменения.**
17. **CSRF-защита — пока не внедрена полностью → новую реализацию только с проверкой по `hash_equals()`.**
18. **Регистрация по email или team = не обязательны → не делай их обязательными.**
19. **Если категория уже используется в `registrations`, нельзя переименовать её в БД → при изменении категорий через админку будет ошибка.**

---

## 🛠 Примеры правил для частых задач

### Добавление новой категории:
1. Проверь: есть ли она в `categories.name`?
2. Если нет → `INSERT INTO categories (name) VALUES (?)`
3. Свяжи с гонкой: `INSERT INTO race_categories (race_id, category_id, sort_order) VALUES (?, ?, ?)`

### Регистрация нового участника:
1. Получи `race_category_id`, `firstName`, `lastName`, `phone`
2. Проверь дубль:
   ```sql
   SELECT id FROM registrations 
   WHERE race_category_id = ? AND phone = ? AND first_name = ? AND last_name = ?
   ```
3. Если есть → 409 Conflict  
   Если нет → `INSERT INTO registrations (...) VALUES (...)`

---

## ✅ Завершение работы

20. **Всегда вызывай `exit` после `json_encode()` или `http_response_code()` в API, чтобы избежать HTML-вывода.**

21. **После изменений — проверь, что `script.js` не ломает `form.submit()` и `fetch(...).then()`**

22. **Сообщай, если изменил `PROJECT_KNOWLEDGE.md` или поведение API — пусть следующий агент знает что изменилось.**
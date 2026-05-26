<?php
session_start();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";

  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  // Получаем JSON-данные
  $rawInput = file_get_contents('php://input');
  $data = json_decode($rawInput, true);

  if (!$data || empty($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Empty or invalid JSON']);
    exit;
  }

  // Проверка существования гонки
  $raceId = $data['race_id'] ?? null;
  if ($raceId === null || !is_numeric($raceId) || (int)$raceId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid race_id']);
    exit;
  }

  $stmt = $pdo->prepare('SELECT id, name, registration_open FROM races WHERE id = ?');
  $stmt->execute([(int)$raceId]);
  $race = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$race) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Race not found']);
    exit;
  }

  if (!$race['registration_open']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Регистрация на эту гонку закрыта']);
    exit;
  }

  // Валидация обязательных полей
  $firstName = trim($data['firstName'] ?? $data['first_name'] ?? '');
  $lastName = trim($data['lastName'] ?? $data['last_name'] ?? '');
  $middleName = trim($data['middleName'] ?? $data['middle_name'] ?? '');
  $birthDate = $data['birthDate'] ?? $data['birth_date'] ?? null;
  $phone = trim($data['phone'] ?? '');
  $email = trim($data['email'] ?? '');
  $city = trim($data['city'] ?? '');
  $team = trim($data['team'] ?? '');
  $raceCategoryId = $data['race_category_id'] ?? null;

  if ($firstName === '' || $lastName === '' || $phone === '' || $email === '' || $city === '' || $birthDate === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Fill all required fields']);
    exit;
  }

  // Форматирование ФИО и города
  $firstName = ucfirst(strtolower($firstName));
  $lastName = ucfirst(strtolower($lastName));
  $middleName = $middleName ? ucfirst(strtolower($middleName)) : null;
  $city = ucfirst(strtolower($city));

  // Проверка дубля по (race_id, phone, first_name, last_name)
  $stmt = $pdo->prepare('
        SELECT id FROM registrations 
        WHERE race_id = ? AND phone = ? AND first_name = ? AND last_name = ?
    ');
  $stmt->execute([(int)$raceId, $phone, $firstName, $lastName]);
  $existing = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existing) {
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => 'Duplicate registration']);
    exit;
  }

  // Проверка race_category_id (если указан)
  if ($raceCategoryId !== null) {
    $stmt = $pdo->prepare('SELECT id, race_id FROM race_categories WHERE id = ?');
    $stmt->execute([(int)$raceCategoryId]);
    $cat = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$cat || (int)$cat['race_id'] !== (int)$raceId) {
      http_response_code(400);
      echo json_encode(['success' => false, 'error' => 'Invalid category for this race']);
      exit;
    }
  }

  // Вставка новой регистрации
  $stmt = $pdo->prepare('
        INSERT INTO registrations 
        (first_name, last_name, middle_name, birth_date, race_id, race_category_id, phone, email, city, team, is_paid) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ');
  $stmt->execute([
    $firstName,
    $lastName,
    $middleName,
    $birthDate,
    (int)$raceId,
    $raceCategoryId ?: null,
    $phone,
    $email,
    $city,
    $team
  ]);

  $insertId = $pdo->lastInsertId();

  echo json_encode([
    'success' => true,
    'message' => 'Registration successful',
    'id' => (int)$insertId
  ]);
  exit;
} catch (PDOException $e) {
  error_log('Register error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Database error']);
  exit;
}

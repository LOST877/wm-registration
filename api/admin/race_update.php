<?php
session_start();
header("Content-Type: application/json");

if (!isset($_SESSION['admin_user'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id']) || !is_numeric($data['id'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid race id']);
  exit;
}

$raceId = (int)$data['id'];
$updates = [];
$params = [];

// Валидация названия до сборки запроса
if (array_key_exists('name', $data) && trim((string)$data['name']) === '') {
  http_response_code(400);
  echo json_encode(['error' => 'Название гонки не может быть пустым']);
  exit;
}

// Булевы поля
foreach (['registration_open', 'is_finished'] as $field) {
  if (array_key_exists($field, $data)) {
    $updates[] = "$field = ?";
    $params[] = (int)$data[$field];
  }
}

// Строковые поля
foreach (['name', 'location', 'iframe_html', 'description', 'payment_info'] as $field) {
  if (array_key_exists($field, $data)) {
    $updates[] = "$field = ?";
    $params[] = $data[$field] !== null ? trim((string)$data[$field]) : null;
  }
}

// location_link — только http/https
if (array_key_exists('location_link', $data)) {
  $link = $data['location_link'] !== null ? trim((string)$data['location_link']) : '';
  if ($link !== '' && !preg_match('#^https?://#i', $link)) {
    http_response_code(400);
    echo json_encode(['error' => 'Ссылка на карту должна начинаться с http:// или https://']);
    exit;
  }
  $updates[] = "location_link = ?";
  $params[] = $link !== '' ? $link : null;
}

// Поле даты: ожидается формат datetime-local YYYY-MM-DDTHH:MM
if (array_key_exists('date', $data) && $data['date'] !== null && $data['date'] !== '') {
  $dt = DateTime::createFromFormat('Y-m-d\TH:i', $data['date']);
  if (!$dt) {
    http_response_code(400);
    echo json_encode(['error' => 'Неверный формат даты']);
    exit;
  }
  $updates[] = "date = ?";
  $params[] = $dt->format('Y-m-d H:i:s');
}

// JSON-поля (sponsors_json, contacts_json)
foreach (['sponsors_json', 'contacts_json'] as $field) {
  if (array_key_exists($field, $data)) {
    $val = $data[$field];
    if ($val !== null && $val !== '') {
      $decoded = json_decode($val);
      if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => "Поле {$field} содержит невалидный JSON"]);
        exit;
      }
      $updates[] = "$field = ?";
      $params[] = trim((string)$val);
    } else {
      $updates[] = "$field = ?";
      $params[] = null;
    }
  }
}

// is_active обрабатывается отдельно (требует транзакцию)
$hasIsActive = array_key_exists('is_active', $data);

if (!$updates && !$hasIsActive) {
  http_response_code(400);
  echo json_encode(['error' => 'No fields to update']);
  exit;
}

try {
  $config = require __DIR__ . '/../../config/db.php';
  $pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );

  $pdo->beginTransaction();

  if ($updates) {
    $params[] = $raceId;
    $stmt = $pdo->prepare('UPDATE races SET ' . implode(', ', $updates) . ' WHERE id = ?');
    $stmt->execute($params);
  }

  // is_active: при установке в 1 — сбросить у всех остальных
  if ($hasIsActive) {
    $isActive = (int)(bool)$data['is_active'];
    if ($isActive === 1) {
      $pdo->prepare('UPDATE races SET is_active = 0')->execute();
    }
    $pdo->prepare('UPDATE races SET is_active = ? WHERE id = ?')->execute([$isActive, $raceId]);
  }

  $pdo->commit();
  echo json_encode(['success' => true]);
  exit;
} catch (PDOException $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  error_log('Race update error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

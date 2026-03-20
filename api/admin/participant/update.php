<?php
session_start();

// Проверка авторизации
if (!isset($_SESSION['admin_user'])) {
  http_response_code(401);
  echo json_encode(['success' => false, 'error' => 'Unauthorized']);
  exit;
}

// Только POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method not allowed']);
  exit;
}

// Получаем JSON-данные
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data || empty($data)) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Empty or invalid JSON']);
  exit;
}

// Обязательные поля
$participantId = $data['id'] ?? null;
$firstName = trim($data['first_name'] ?? '');
$lastName = trim($data['last_name'] ?? '');
$middleName = trim($data['middle_name'] ?? '');
$birthDate = $data['birth_date'] ?? null;
$raceId = $data['race_id'] ?? null;
$raceCategoryId = $data['race_category_id'] ?? null;
$phone = trim($data['phone'] ?? '');
$email = trim($data['email'] ?? '');
$city = trim($data['city'] ?? '');
$team = trim($data['team'] ?? '');
$isPaid = $data['is_paid'] ?? null;

if ($participantId === null || !is_numeric($participantId) || (int)$participantId <= 0) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Invalid participant ID']);
  exit;
}

if ($firstName === '' || $lastName === '') {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'First name and last name are required']);
  exit;
}

if ($raceId === null || !is_numeric($raceId) || (int)$raceId <= 0) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Invalid race ID']);
  exit;
}

// Форматирование ФИО
$firstName = ucfirst(strtolower($firstName));
$lastName = ucfirst(strtolower($lastName));
$middleName = $middleName ? ucfirst(strtolower($middleName)) : null;
$city = $city ? ucfirst(strtolower($city)) : null;
$team = $team ? trim($team) : null;

// Проверка race_category_id (опционально)
if ($raceCategoryId !== null && (!is_numeric($raceCategoryId) || (int)$raceCategoryId <= 0)) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Invalid race_category_id']);
  exit;
}

// Проверка is_paid (0 или 1)
if ($isPaid !== '0' && $isPaid !== '1') {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Invalid is_paid value']);
  exit;
}

try {
  $config = require __DIR__ . '/../../../config/db.php';
  $pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );

  // Проверяем, существует ли участник
  $stmt = $pdo->prepare('SELECT id, race_id, race_category_id FROM registrations WHERE id = ?');
  $stmt->execute([(int)$participantId]);
  $current = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$current) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Participant not found']);
    exit;
  }

  // Если race_category_id не совпадает с новым — проверяем, что новая категория принадлежит текущей гонке
  if ($raceCategoryId !== null && $raceCategoryId != $current['race_category_id']) {
    $stmt = $pdo->prepare('SELECT race_id FROM race_categories WHERE id = ?');
    $stmt->execute([(int)$raceCategoryId]);
    $newCat = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$newCat || (int)$newCat['race_id'] !== (int)$raceId) {
      http_response_code(400);
      echo json_encode(['success' => false, 'error' => 'Category does not belong to the selected race']);
      exit;
    }
  }

  // Обновляем данные
  $stmt = $pdo->prepare('
        UPDATE registrations 
        SET 
            first_name = ?,
            last_name = ?,
            middle_name = ?,
            birth_date = ?,
            race_id = ?,
            race_category_id = ?,
            phone = ?,
            email = ?,
            city = ?,
            team = ?,
            is_paid = ?
        WHERE id = ?
    ');
  $stmt->execute([
    $firstName,
    $lastName,
    $middleName,
    $birthDate ?: null,
    (int)$raceId,
    $raceCategoryId ?: null,
    $phone,
    $email,
    $city,
    $team,
    (int)$isPaid,
    (int)$participantId
  ]);

  $affected = $stmt->rowCount();

  if ($affected === 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'No changes saved']);
    exit;
  }

  echo json_encode([
    'success' => true,
    'message' => 'Данные участника обновлены',
    'participant' => [
      'id' => (int)$participantId,
      'first_name' => $firstName,
      'last_name' => $lastName,
      'middle_name' => $middleName,
      'birth_date' => $birthDate,
      'race_id' => (int)$raceId,
      'race_category_id' => $raceCategoryId,
      'phone' => $phone,
      'email' => $email,
      'city' => $city,
      'team' => $team,
      'is_paid' => (int)$isPaid
    ]
  ]);
  exit;
} catch (PDOException $e) {
  error_log('Admin participant update error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Database error']);
  exit;
}

<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";
  
  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Нет данных']);
    exit;
  }

  // Форматирование ФИО ( первая буква заглавная, остальные — маленькие )
  $lastName = mb_ucfirst(mb_strtolower(trim($input['lastName'] ?? '')));
  $firstName = mb_ucfirst(mb_strtolower(trim($input['firstName'] ?? '')));
  $middleName = mb_ucfirst(mb_strtolower(trim($input['middleName'] ?? '')));
  $city = mb_ucfirst(mb_strtolower(trim($input['city'] ?? '')));

  if (!$lastName || !$firstName) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Фамилия и имя обязательны']);
    exit;
  }

  $raceId = $input['race_id'] ?? 1;
  $phone = trim($input['phone'] ?? '');
  $email = trim($input['email'] ?? '');
  $raceCategoryId = $input['race_category_id'];

  // 1. Проверка: гонка существует и активна
  $stmt = $pdo->prepare("SELECT date FROM races WHERE id = ? AND is_active = 1");
  $stmt->execute([$raceId]);
  $race = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$race) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Гонка не найдена или завершена']);
    exit;
  }

  // 2. Проверка: не прошла ли дата гонки
  if (new DateTime() > new DateTime($race['date'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Регистрация на эту гонку закрыта']);
    exit;
  }

  // 3. Проверка дублирования по phone + first_name + last_name
  $stmt = $pdo->prepare("
    SELECT reg.id, c.name AS category_name 
    FROM registrations reg
    JOIN race_categories rc ON reg.race_category_id = rc.id
    JOIN categories c ON rc.category_id = c.id
    WHERE reg.phone = ? AND reg.first_name = ? AND reg.last_name = ?
  ");
  $stmt->execute([$phone, $firstName, $lastName]);
  $existingReg = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existingReg) {
    http_response_code(409); // Conflict
    echo json_encode([
      'success' => false,
      'message' => "Участник $firstName $lastName с телефоном $phone уже зарегистрирован на эту гонку в категории «" . $existingReg['category_name'] . "»."
    ]);
    exit;
  }

  // 4. Вставка новой регистрации
  $stmt = $pdo->prepare("
    INSERT INTO registrations 
      (last_name, first_name, middle_name, birth_date, city, phone, email, team, race_category_id)
    VALUES 
      (:last_name, :first_name, :middle_name, :birth_date, :city, :phone, :email, :team, :race_category_id)
  ");

  $stmt->execute([
    ':last_name' => $lastName,
    ':first_name' => $firstName,
    ':middle_name' => $middleName,
    ':birth_date' => $input['birthDate'],
    ':city' => $city,
    ':phone' => $phone,
    ':email' => $email,
    ':team' => $input['team'] ?? null,
    ':race_category_id' => $raceCategoryId,
  ]);

  echo json_encode([
    'success' => true,
    'message' => 'Регистрация прошла успешно!',
    'race_id' => $raceId
  ]);

} catch (Exception $e) {
  // Не раскрываем детали ошибки пользователю!
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Ошибка сервера. Попробуйте позже.']);
}

// Функция для правильного "заглавно-строчного" форматирования (поддержка кириллицы)
function mb_ucfirst($string) {
  return mb_strtoupper(mb_substr($string, 0, 1)) . mb_strtolower(mb_substr($string, 1));
}
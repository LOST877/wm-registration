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

$raceId = isset($_POST['race_id']) && is_numeric($_POST['race_id']) ? (int)$_POST['race_id'] : null;
$type   = $_POST['type'] ?? '';

if (!$raceId || !in_array($type, ['desktop', 'mobile'], true)) {
  http_response_code(400);
  echo json_encode(['error' => 'Неверные параметры (race_id или type)']);
  exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'Файл не загружен или произошла ошибка загрузки']);
  exit;
}

$allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
$ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
  http_response_code(400);
  echo json_encode(['error' => 'Недопустимый тип файла. Разрешены: jpg, jpeg, png, webp']);
  exit;
}

if ($_FILES['file']['size'] > 5 * 1024 * 1024) {
  http_response_code(400);
  echo json_encode(['error' => 'Файл слишком большой (максимум 5 MB)']);
  exit;
}

$uploadDir = __DIR__ . '/../../assets/races/';
if (!is_dir($uploadDir)) {
  mkdir($uploadDir, 0755, true);
}

$filename = sprintf('race_%d_%s_%s.%s', $raceId, $type, bin2hex(random_bytes(8)), $ext);
$destPath = $uploadDir . $filename;

if (!move_uploaded_file($_FILES['file']['tmp_name'], $destPath)) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сохранения файла на сервере']);
  exit;
}

$column = $type === 'desktop' ? 'banner_desktop' : 'banner_mobile';

try {
  $config = require __DIR__ . '/../../config/db.php';
  $pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );

  $stmt = $pdo->prepare("UPDATE races SET {$column} = ? WHERE id = ?");
  $stmt->execute([$filename, $raceId]);

  echo json_encode([
    'success'  => true,
    'filename' => $filename,
    'url'      => "assets/races/{$filename}",
  ]);
  exit;
} catch (PDOException $e) {
  // Удаляем файл, если БД обновить не удалось — не оставляем orphan
  @unlink($destPath);
  error_log('Race upload error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

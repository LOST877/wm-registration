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
$allowed = ['registration_open', 'is_finished'];
$updates = [];
$params = [];

foreach ($allowed as $field) {
  if (array_key_exists($field, $data)) {
    $updates[] = "$field = ?";
    $params[] = (int)$data[$field];
  }
}

if (!$updates) {
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

  $params[] = $raceId;
  $stmt = $pdo->prepare('UPDATE races SET ' . implode(', ', $updates) . ' WHERE id = ?');
  $stmt->execute($params);

  echo json_encode(['success' => true]);
  exit;
} catch (PDOException $e) {
  error_log('Race update error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

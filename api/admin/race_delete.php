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
if (!isset($data['race_id']) || !is_numeric($data['race_id'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid race_id']);
  exit;
}

$raceId = (int)$data['race_id'];

try {
  $config = require __DIR__ . '/../../config/db.php';
  $pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );

  $stmt = $pdo->prepare('DELETE FROM races WHERE id = ?');
  $stmt->execute([$raceId]);

  echo json_encode(['success' => true]);
  exit;
} catch (PDOException $e) {
  error_log('Race delete error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

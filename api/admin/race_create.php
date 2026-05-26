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

try {
  $config = require __DIR__ . '/../../config/db.php';
  $pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );

  $defaultDate = date('Y-m-d H:i:s', strtotime('+30 days'));
  $stmt = $pdo->prepare(
    'INSERT INTO races (name, date, is_active, registration_open, is_finished) VALUES (?, ?, 0, 1, 0)'
  );
  $stmt->execute(['Новая гонка', $defaultDate]);
  $newId = (int)$pdo->lastInsertId();

  echo json_encode(['success' => true, 'id' => $newId]);
  exit;
} catch (PDOException $e) {
  error_log('Race create error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

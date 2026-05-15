<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";

  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  // Получаем первую активную гонку
  $stmt = $pdo->prepare("
    SELECT id, name, date, location, location_link, iframe_html, description, payment_info, registration_open
    FROM races
    WHERE is_active = 1 
    ORDER BY date ASC 
    LIMIT 1
  ");
  $stmt->execute();
  $race = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$race) {
    http_response_code(404);
    echo json_encode(['error' => 'Нет активных гонок']);
    exit;
  }

  echo json_encode($race);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера: ' . $e->getMessage()]);
}

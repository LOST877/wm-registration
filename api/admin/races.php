<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

try {
  $config = require_once __DIR__ . '/../../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";
  
  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  // Получаем все гонки
  $stmt = $pdo->prepare("
    SELECT id, name, date, location, is_active
    FROM races 
    ORDER BY date DESC
  ");
  $stmt->execute();
  $races = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode($races);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера: ' . $e->getMessage()]);
}

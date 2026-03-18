<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";
  
  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  $raceId = (int)($_GET['race_id'] ?? 1);

  $stmt = $pdo->prepare("
    SELECT c.id, c.name, COALESCE(rc.sort_order, 0) AS sort_order
    FROM categories c
    JOIN race_categories rc ON c.id = rc.category_id
    WHERE rc.race_id = ?
    ORDER BY rc.sort_order ASC, c.id ASC
  ");
  $stmt->execute([$raceId]);
  $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode($categories);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера']);
}
<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if (!isset($_GET['race_id']) || !is_numeric($_GET['race_id'])) {
  http_response_code(400);
  echo json_encode(['error' => 'race_id обязателен']);
  exit;
}

$raceId = (int)$_GET['race_id'];

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4";
  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  $stmt = $pdo->prepare("
    SELECT place, bib_number, last_name, first_name, middle_name,
           city, birth_year, category, laps
    FROM race_results
    WHERE race_id = ?
    ORDER BY place ASC
  ");
  $stmt->execute([$raceId]);
  $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

  foreach ($results as &$r) {
    $r['laps'] = $r['laps'] ? json_decode($r['laps'], true) : [];
  }
  unset($r);

  echo json_encode(['success' => true, 'results' => $results]);
  exit;
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера: ' . $e->getMessage()]);
  exit;
}

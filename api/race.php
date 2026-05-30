<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";

  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  $raceId = isset($_GET['race_id']) ? (int)$_GET['race_id'] : null;

  if ($raceId !== null && $raceId > 0) {
    $stmt = $pdo->prepare("
      SELECT id, name, date, location, location_link, iframe_html, description, payment_info, payment_tiers,
             registration_open, is_finished, banner_desktop, banner_mobile, sponsors_json, contacts_json
      FROM races
      WHERE id = ?
    ");
    $stmt->execute([$raceId]);
  } else {
    $stmt = $pdo->prepare("
      SELECT id, name, date, location, location_link, iframe_html, description, payment_info, payment_tiers,
             registration_open, is_finished, banner_desktop, banner_mobile, sponsors_json, contacts_json
      FROM races
      WHERE is_active = 1
      ORDER BY date ASC
      LIMIT 1
    ");
    $stmt->execute();
  }

  $race = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$race) {
    http_response_code(404);
    echo json_encode(['error' => 'Гонка не найдена']);
    exit;
  }

  // Декодируем JSON-поля
  $race['payment_tiers'] = $race['payment_tiers'] ? json_decode($race['payment_tiers'], true) : [];

  echo json_encode($race);
  exit;
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера: ' . $e->getMessage()]);
}

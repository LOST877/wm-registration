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
        SELECT 
            r.id,
            r.last_name,
            r.first_name,
            r.middle_name,
            r.birth_date,
            r.city,
            r.phone,
            r.email,
            r.team,
            r.is_paid,
            c.name AS category
        FROM registrations r
        LEFT JOIN race_categories rc ON r.race_category_id = rc.id
        LEFT JOIN categories c ON rc.category_id = c.id
        WHERE r.race_id = ?
        ORDER BY r.created_at DESC
    ");
  $stmt->execute([$raceId]);
  $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode($participants);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера']);
}

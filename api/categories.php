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
    SELECT c.id, c.name, c.age_from, c.age_to, c.description,
           COALESCE(rc.sort_order, 0) AS sort_order,
           rc.distance_km, rc.laps, rc.elevation_m
    FROM categories c
    JOIN race_categories rc ON c.id = rc.category_id
    WHERE rc.race_id = ?
    ORDER BY rc.sort_order ASC, c.id ASC
  ");
  $stmt->execute([$raceId]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Приводим числовые поля к правильным типам
  $categories = array_map(function ($r) {
    return [
      'id'          => (int)$r['id'],
      'name'        => $r['name'],
      'age_from'    => $r['age_from'] !== null ? (int)$r['age_from'] : null,
      'age_to'      => $r['age_to']   !== null ? (int)$r['age_to']   : null,
      'description' => $r['description'],
      'sort_order'  => (int)$r['sort_order'],
      'distance_km' => $r['distance_km'] !== null ? (float)$r['distance_km'] : null,
      'laps'        => $r['laps']        !== null ? (int)$r['laps']           : null,
      'elevation_m' => $r['elevation_m'] !== null ? (int)$r['elevation_m']   : null,
    ];
  }, $rows);

  echo json_encode($categories);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера']);
}
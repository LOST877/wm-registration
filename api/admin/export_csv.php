<?php
session_start();

if (!isset($_SESSION['admin_user'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

$raceId = isset($_GET['race_id']) ? intval($_GET['race_id']) : 0;
if ($raceId <= 0) {
  http_response_code(400);
  echo json_encode(['error' => 'race_id required']);
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

  $raceStmt = $pdo->prepare('SELECT name FROM races WHERE id = ?');
  $raceStmt->execute([$raceId]);
  $race = $raceStmt->fetch(PDO::FETCH_ASSOC);
  if (!$race) {
    http_response_code(404);
    echo json_encode(['error' => 'Race not found']);
    exit;
  }

  $stmt = $pdo->prepare('
    SELECT
      reg.last_name,
      reg.first_name,
      reg.middle_name,
      reg.birth_date,
      c.name AS category_name
    FROM registrations reg
    LEFT JOIN race_categories rc ON reg.race_category_id = rc.id
    LEFT JOIN categories c ON rc.category_id = c.id
    WHERE reg.race_id = ?
    ORDER BY reg.last_name, reg.first_name
  ');
  $stmt->execute([$raceId]);
  $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);

  $filename = 'participants_race_' . $raceId . '_' . date('Y-m-d') . '.csv';

  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="' . $filename . '"');
  header('Cache-Control: no-cache, no-store');

  $out = fopen('php://output', 'w');

  // UTF-8 BOM для корректного открытия в Excel
  fwrite($out, "\xEF\xBB\xBF");

  fputcsv($out, ['Фамилия', 'Имя', 'Отчество', 'Дата рождения', 'Категория'], ';');

  foreach ($participants as $p) {
    $birthDate = '';
    if (!empty($p['birth_date'])) {
      $d = DateTime::createFromFormat('Y-m-d', $p['birth_date']);
      if ($d) {
        $birthDate = $d->format('d.m.Y');
      }
    }
    fputcsv($out, [
      $p['last_name'],
      $p['first_name'],
      $p['middle_name'] ?? '',
      $birthDate,
      $p['category_name'] ?? '',
    ], ';');
  }

  fclose($out);
  exit;
} catch (PDOException $e) {
  error_log('Export CSV error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

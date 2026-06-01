<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$ruMonths = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function deriveStatus($row) {
  if ($row['is_finished']) return ['status' => 'done',   'status_label' => 'Завершена'];
  if ($row['registration_open']) return ['status' => 'open', 'status_label' => 'Открыта'];
  if ($row['is_active']) return ['status' => 'closed', 'status_label' => 'Закрыта'];
  return ['status' => 'soon', 'status_label' => 'Скоро'];
}

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";

  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  $stmt = $pdo->prepare("
    SELECT id, name, stage, date, location, is_active, is_finished, registration_open
    FROM races
    WHERE is_active = 1 OR is_finished = 1
    ORDER BY date DESC
  ");
  $stmt->execute();
  $races = $stmt->fetchAll(PDO::FETCH_ASSOC);

  $result = [];
  foreach ($races as $row) {
    $st = deriveStatus($row);
    $dateLabel = '';
    if ($row['date']) {
      $dt = new DateTime($row['date']);
      $d = (int)$dt->format('j');
      $m = (int)$dt->format('n');
      $y = $dt->format('Y');
      $dateLabel = $d . ' ' . $ruMonths[$m - 1] . ' ' . $y . ' г.';
    }
    $result[] = [
      'id'           => (int)$row['id'],
      'name'         => $row['name'],
      'stage'        => $row['stage'],
      'date'         => $row['date'],
      'date_label'   => $dateLabel,
      'location'     => $row['location'],
      'is_active'    => (int)$row['is_active'],
      'is_finished'  => (int)$row['is_finished'],
      'registration_open' => (int)$row['registration_open'],
      'status'       => $st['status'],
      'status_label' => $st['status_label'],
    ];
  }

  echo json_encode($result);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка сервера: ' . $e->getMessage()]);
}

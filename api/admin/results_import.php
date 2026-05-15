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

if (!isset($_POST['race_id']) || !is_numeric($_POST['race_id'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid race_id']);
  exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'Файл не загружен']);
  exit;
}

$raceId = (int)$_POST['race_id'];
$tmpFile = $_FILES['file']['tmp_name'];

$content = file_get_contents($tmpFile);
$encoding = mb_detect_encoding($content, ['UTF-8', 'Windows-1251', 'CP1251'], true);
if ($encoding && strtolower($encoding) !== 'utf-8') {
  $content = mb_convert_encoding($content, 'UTF-8', $encoding);
}

$tmpConverted = tempnam(sys_get_temp_dir(), 'csv_');
file_put_contents($tmpConverted, $content);

try {
  $config = require __DIR__ . '/../../config/db.php';
  $pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
  );

  $handle = fopen($tmpConverted, 'r');
  if (!$handle) throw new Exception('Не удалось открыть файл');

  fgetcsv($handle); // пропустить заголовок

  $rows = [];
  while (($line = fgetcsv($handle)) !== false) {
    if (count($line) < 8) continue;
    $rows[] = $line;
  }
  fclose($handle);
  unlink($tmpConverted);

  $pdo->prepare('DELETE FROM race_results WHERE race_id = ?')->execute([$raceId]);

  $stmt = $pdo->prepare("
    INSERT INTO race_results
      (race_id, place, bib_number, last_name, first_name, middle_name,
       city, birth_year, category, laps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ");

  $imported = 0;
  foreach ($rows as $row) {
    $place      = (int)($row[0] ?? 0);
    $bib        = isset($row[1]) && $row[1] !== '' ? (int)$row[1] : null;
    $lastName   = trim($row[2] ?? '');
    $firstName  = trim($row[3] ?? '');
    $middleName = trim($row[4] ?? '') ?: null;
    $city       = trim($row[5] ?? '') ?: null;
    $birthYear  = isset($row[6]) && $row[6] !== '' ? (int)$row[6] : null;
    $category   = trim($row[7] ?? '') ?: null;

    $laps = [];
    for ($i = 8; isset($row[$i]); $i++) {
      $v = trim($row[$i]);
      if ($v === '' || $v === '-') break;
      $laps[] = $v;
    }

    if (!$lastName || !$firstName) continue;

    $stmt->execute([
      $raceId, $place, $bib, $lastName, $firstName, $middleName,
      $city, $birthYear, $category,
      $laps ? json_encode($laps, JSON_UNESCAPED_UNICODE) : null,
    ]);
    $imported++;
  }

  echo json_encode(['success' => true, 'imported' => $imported]);
  exit;
} catch (PDOException $e) {
  error_log('Results import error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка базы данных']);
  exit;
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
  exit;
}

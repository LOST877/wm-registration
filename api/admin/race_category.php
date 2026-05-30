<?php
session_start();
header('Content-Type: application/json');

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

$data = json_decode(file_get_contents('php://input'), true);
if (!$data || !isset($data['action'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid request']);
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

  $action = $data['action'];

  // ─── ADD ─────────────────────────────────────────────────────────────
  if ($action === 'add') {
    $raceId = isset($data['race_id']) ? (int)$data['race_id'] : 0;
    $name   = isset($data['name']) ? trim($data['name']) : '';

    if ($raceId <= 0 || $name === '' || mb_strlen($name) > 100) {
      http_response_code(400);
      echo json_encode(['error' => 'Некорректные данные']);
      exit;
    }

    // Проверить что гонка существует
    $stmt = $pdo->prepare('SELECT id FROM races WHERE id = ?');
    $stmt->execute([$raceId]);
    if (!$stmt->fetch()) {
      http_response_code(404);
      echo json_encode(['error' => 'Гонка не найдена']);
      exit;
    }

    $pdo->beginTransaction();

    // Найти или создать категорию
    $pdo->prepare('INSERT IGNORE INTO categories (name) VALUES (?)')->execute([$name]);
    $stmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
    $stmt->execute([$name]);
    $category = $stmt->fetch(PDO::FETCH_ASSOC);

    // Следующий sort_order для этой гонки
    $stmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM race_categories WHERE race_id = ?');
    $stmt->execute([$raceId]);
    $nextOrder = (int)$stmt->fetchColumn();

    // Привязать категорию к гонке
    try {
      $stmt = $pdo->prepare('INSERT INTO race_categories (race_id, category_id, sort_order) VALUES (?, ?, ?)');
      $stmt->execute([$raceId, $category['id'], $nextOrder]);
      $newRcId = (int)$pdo->lastInsertId();
    } catch (PDOException $e) {
      $pdo->rollBack();
      if ($e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode(['error' => 'Категория уже добавлена к этой гонке']);
        exit;
      }
      throw $e;
    }

    $pdo->commit();

    echo json_encode([
      'success'          => true,
      'race_category_id' => $newRcId,
      'category_id'      => (int)$category['id'],
      'category_name'    => $name,
      'sort_order'       => $nextOrder,
    ]);
    exit;
  }

  // ─── REMOVE ──────────────────────────────────────────────────────────
  if ($action === 'remove') {
    $rcId      = isset($data['race_category_id']) ? (int)$data['race_category_id'] : 0;
    $confirmed = !empty($data['confirmed']);

    if ($rcId <= 0) {
      http_response_code(400);
      echo json_encode(['error' => 'Некорректный идентификатор']);
      exit;
    }

    // Проверить что запись существует
    $stmt = $pdo->prepare('SELECT id FROM race_categories WHERE id = ?');
    $stmt->execute([$rcId]);
    if (!$stmt->fetch()) {
      http_response_code(404);
      echo json_encode(['error' => 'Категория гонки не найдена']);
      exit;
    }

    // Подсчёт участников с этой категорией
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM registrations WHERE race_category_id = ?');
    $stmt->execute([$rcId]);
    $affectedCount = (int)$stmt->fetchColumn();

    if ($affectedCount > 0 && !$confirmed) {
      echo json_encode([
        'success'          => false,
        'warn'             => true,
        'affected_count'   => $affectedCount,
        'race_category_id' => $rcId,
      ]);
      exit;
    }

    // FK ON DELETE SET NULL обнуляет race_category_id у участников автоматически
    $pdo->prepare('DELETE FROM race_categories WHERE id = ?')->execute([$rcId]);

    echo json_encode(['success' => true, 'race_category_id' => $rcId]);
    exit;
  }

  // ─── REORDER ─────────────────────────────────────────────────────────
  if ($action === 'reorder') {
    $raceId     = isset($data['race_id']) ? (int)$data['race_id'] : 0;
    $orderedIds = $data['ordered_ids'] ?? [];

    if ($raceId <= 0 || !is_array($orderedIds) || count($orderedIds) === 0) {
      http_response_code(400);
      echo json_encode(['error' => 'Некорректные данные']);
      exit;
    }

    $orderedIds = array_map('intval', $orderedIds);

    // Получить полный список ID категорий гонки и сравнить как множества
    $stmt = $pdo->prepare('SELECT id FROM race_categories WHERE race_id = ?');
    $stmt->execute([$raceId]);
    $allRaceIds = array_map('intval', array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id'));

    $submitted = $orderedIds;
    sort($submitted);
    sort($allRaceIds);

    if ($submitted !== $allRaceIds) {
      http_response_code(400);
      echo json_encode(['error' => 'Список категорий не совпадает с категориями гонки']);
      exit;
    }

    $pdo->beginTransaction();
    $updateStmt = $pdo->prepare('UPDATE race_categories SET sort_order = ? WHERE id = ? AND race_id = ?');
    foreach ($orderedIds as $idx => $rcId) {
      $updateStmt->execute([$idx + 1, $rcId, $raceId]);
    }
    $pdo->commit();

    echo json_encode(['success' => true]);
    exit;
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────
  // Обновляет данные race_category (дистанция, круги, набор) и категории (возраст, описание)
  if ($action === 'update') {
    $rcId = isset($data['race_category_id']) ? (int)$data['race_category_id'] : 0;
    if ($rcId <= 0) {
      http_response_code(400);
      echo json_encode(['error' => 'Некорректный идентификатор']);
      exit;
    }

    // Проверить что запись существует и получить category_id
    $stmt = $pdo->prepare('SELECT category_id FROM race_categories WHERE id = ?');
    $stmt->execute([$rcId]);
    $rc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$rc) {
      http_response_code(404);
      echo json_encode(['error' => 'Запись не найдена']);
      exit;
    }
    $categoryId = (int)$rc['category_id'];

    $pdo->beginTransaction();

    // Обновляем race_categories: distance_km, laps, elevation_m
    $rcUpdates = [];
    $rcParams  = [];
    foreach (['distance_km', 'laps', 'elevation_m'] as $f) {
      if (array_key_exists($f, $data)) {
        $rcUpdates[] = "$f = ?";
        $rcParams[]  = $data[$f] !== null && $data[$f] !== '' ? $data[$f] : null;
      }
    }
    if ($rcUpdates) {
      $rcParams[] = $rcId;
      $pdo->prepare('UPDATE race_categories SET ' . implode(', ', $rcUpdates) . ' WHERE id = ?')
          ->execute($rcParams);
    }

    // Обновляем categories: age_from, age_to, description
    $catUpdates = [];
    $catParams  = [];
    foreach (['age_from', 'age_to'] as $f) {
      if (array_key_exists($f, $data)) {
        $catUpdates[] = "$f = ?";
        $catParams[]  = $data[$f] !== null && $data[$f] !== '' ? (int)$data[$f] : null;
      }
    }
    if (array_key_exists('description', $data)) {
      $catUpdates[] = "description = ?";
      $catParams[]  = $data['description'] !== null ? trim((string)$data['description']) : null;
    }
    if ($catUpdates) {
      $catParams[] = $categoryId;
      $pdo->prepare('UPDATE categories SET ' . implode(', ', $catUpdates) . ' WHERE id = ?')
          ->execute($catParams);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);
    exit;
  }

  http_response_code(400);
  echo json_encode(['error' => 'Неизвестное действие']);
  exit;

} catch (PDOException $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  error_log('race_category error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Ошибка базы данных']);
  exit;
}

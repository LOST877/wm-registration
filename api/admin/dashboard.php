<?php
session_start();

// Проверка авторизации
if (!isset($_SESSION['admin_user'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
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

  // 1. Все гонки с количеством участников
  $racesStmt = $pdo->prepare('
        SELECT 
            r.id,
            r.name AS race_name,
            r.date,
            r.location,
            r.payment_info,
            COUNT(reg.id) AS participants_count
        FROM races r
        LEFT JOIN registrations reg ON r.id = reg.race_id
        GROUP BY r.id
        ORDER BY r.date DESC
    ');
  $racesStmt->execute();
  $races = $racesStmt->fetchAll(PDO::FETCH_ASSOC);

  // 2. Категории гонки и участники
  $races_with_categories = [];
  foreach ($races as $race) {
    // 2.1. Категории гонки
    $stmt = $pdo->prepare('
            SELECT c.id, c.name AS category_name
            FROM race_categories rc
            JOIN categories c ON rc.category_id = c.id
            WHERE rc.race_id = ?
            ORDER BY rc.sort_order
        ');
    $stmt->execute([$race['id']]);
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2.2. Участники — напрямую по race_id
    $stmt = $pdo->prepare('
            SELECT 
                reg.id,
                reg.last_name,
                reg.first_name,
                reg.middle_name,
                reg.birth_date,
                reg.is_paid,
                reg.payment_amount,
                reg.phone,
                reg.email,
                reg.city,
                reg.team,
                c.name AS category_name,
                reg.created_at
            FROM registrations reg
            LEFT JOIN race_categories rc ON reg.race_category_id = rc.id
            LEFT JOIN categories c ON rc.category_id = c.id
            WHERE reg.race_id = ?
            ORDER BY reg.created_at DESC
        ');
    $stmt->execute([$race['id']]);
    $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $race['categories'] = $categories;
    $race['participants'] = $participants;

    $races_with_categories[] = $race;
  }

  // 3. Все доступные категории
  $stmt = $pdo->prepare('SELECT id, name FROM categories ORDER BY name');
  $stmt->execute();
  $allCategories = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode([
    'success' => true,
    'races' => $races_with_categories,
    'all_categories' => $allCategories
  ]);
  exit;
} catch (PDOException $e) {
  error_log('Admin dashboard error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

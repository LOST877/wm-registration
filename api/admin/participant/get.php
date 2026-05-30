<?php
session_start();

// Проверка авторизации
if (!isset($_SESSION['admin_user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// Только GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$participantId = $_GET['id'] ?? null;

if ($participantId === null || !is_numeric($participantId) || (int)$participantId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid participant ID']);
    exit;
}

try {
    $config = require __DIR__ . '/../../../config/db.php';
    $pdo = new PDO(
        "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $stmt = $pdo->prepare('
        SELECT 
            r.id,
            r.last_name,
            r.first_name,
            r.middle_name,
            r.birth_date,
            r.race_id,
            r.race_category_id,
            r.phone,
            r.email,
            r.city,
            r.team,
            r.is_paid,
            r.payment_amount,
            c.id AS category_id,
            c.name AS category_name
        FROM registrations r
        LEFT JOIN race_categories rc ON r.race_category_id = rc.id
        LEFT JOIN categories c ON rc.category_id = c.id
        WHERE r.id = ?
    ');
    $stmt->execute([(int)$participantId]);
    $participant = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$participant) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Participant not found']);
        exit;
    }

    // Получить список всех категорий для текущей гонки
    $stmt = $pdo->prepare('
        SELECT rc.id AS race_category_id, c.id, c.name
        FROM race_categories rc
        JOIN categories c ON rc.category_id = c.id
        WHERE rc.race_id = ?
        ORDER BY rc.sort_order
    ');
    $stmt->execute([(int)$participant['race_id']]);
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'participant' => $participant,
        'categories' => $categories
    ]);
    exit;
} catch (PDOException $e) {
    error_log('Admin participant get error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}

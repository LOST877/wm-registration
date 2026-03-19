<?php
session_start();

// Логирование — временно
error_log('_auth.php: REQUEST_METHOD = ' . ($_SERVER['REQUEST_METHOD'] ?? 'NONE'));
error_log('_auth.php: POST = ' . print_r($_POST, true));

// Если не POST — сразу 405
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

// Обязательные поля
$user = $_POST['username'] ?? '';
$pwd = $_POST['password'] ?? '';

error_log('_auth.php: username = ' . ($user ?: '(empty)'));
error_log('_auth.php: password = ' . ($pwd ?: '(empty)'));

if ($user === '' || $pwd === '') {
  http_response_code(400);
  echo json_encode(['error' => 'Missing username or password']);
  exit;
}

try {
  $configPath = __DIR__ . '/../../config/db.php';
  if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Config file not found: ' . $configPath]);
    exit;
  }

  $config = require $configPath;

  // Отладка конфига
  error_log('_auth.php: config = ' . print_r($config, true));

  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4";
  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_PERSISTENT => false
  ]);

  // Проверка соединения
  error_log('_auth.php: DSN = ' . $dsn);
  error_log('_auth.php: selected DB = ' . $config['dbname']);

  // Проверка таблицы
  try {
    $tables = $pdo->query("SHOW TABLES LIKE 'admin_users'")->fetch();
    error_log('_auth.php: table admin_users exists = ' . ($tables ? 'YES' : 'NO'));
  } catch (Exception $e) {
    error_log('_auth.php: table check error = ' . $e->getMessage());
  }

  $stmt = $pdo->prepare('SELECT id, username, password, full_name FROM admin_users WHERE username = ?');
  $stmt->execute([$user]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  error_log('_auth.php: user found = ' . ($user ? 'YES' : 'NO'));

  if (!$user || !password_verify($pwd, $user['password'])) {
    error_log('_auth.php: verify result = ' . (!$user ? 'NO_USER' : (password_verify($pwd, $user['password']) ? 'OK' : 'FAIL')));
    http_response_code(401);
    echo json_encode(['error' => 'Неверное имя пользователя/пароль']);
    exit;
  }

  // Успешная авторизация
  $_SESSION['admin_user'] = [
    'id' => $user['id'],
    'username' => $user['username'],
    'full_name' => $user['full_name']
  ];

  error_log('_auth.php: SESSION set = ' . print_r($_SESSION, true));

  echo json_encode([
    'success' => true,
    'message' => 'Авторизация успешна',
    'full_name' => $user['full_name']
  ]);
  exit;
} catch (PDOException $e) {
  error_log('_auth.php: PDOException = ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Database error']);
  exit;
}

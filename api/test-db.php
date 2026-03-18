<?php
header("Content-Type: text/plain; charset=utf-8");

// Параметры — уточните по встроенной конфигурации
$host = '127.0.1.29';
$port = '3306'; // ← замените, если порт другой
$dbname = 'wm_reg';
$username = 'root';
$password = '';

echo "Попытка подключения...\n";
echo "Host: $host\nPort: $port\nUser: $username\nPass: [пустой/не пустой]\n\n";

// Сначала проверяем, доступен ли порт
$connection = @fsockopen($host, $port, $errno, $errstr, 1);
if ($connection) {
  echo "✅ Порт $port доступен.\n";
  fclose($connection);
} else {
  echo "❌ Ошибка подключения к порту: $errstr ($errno)\n";
  echo "Возможно, MySQL не слушает этот порт.\n";
  exit;
}

try {
  $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
  $pdo = new PDO($dsn, $username, $password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  echo "✅ Подключение успешно!\n";
  echo "Сервер: " . $pdo->query("SELECT VERSION()")->fetchColumn() . "\n";
  
  // Проверка таблиц
  $stmt = $pdo->query("SHOW TABLES");
  $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
  echo "Таблицы в '$dbname': " . ($tables ? implode(", ", $tables) : "нет") . "\n";

  // Проверка гонки
  $races = $pdo->query("SELECT id, name, is_active FROM races")->fetchAll();
  echo "Гонок: " . count($races) . "\n";
  foreach ($races as $race) {
    echo "  - ID $race[0]: '$race[1]' (active: " . ($race[2] ? 'Да' : 'Нет') . ")\n";
  }

} catch (PDOException $e) {
  echo "❌ Ошибка подключения к БД:\n";
  echo "Сообщение: " . $e->getMessage() . "\n";
  echo "Код: " . $e->getCode() . "\n";
  echo "Файл: " . $e->getFile() . ":" . $e->getLine() . "\n";
}
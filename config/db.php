<?php
// Читаем переменные из .htaccess через getenv()
$host     = getenv('DB_HOST') ?: '127.0.1.29';
$port     = getenv('DB_PORT') ?: 3306;
$dbname   = getenv('DB_NAME') ?: 'wm_reg';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASS') ?: '';
$charset  = getenv('DB_CHARSET') ?: 'utf8';

return [
  'host'     => $host,
  'port'     => $port,
  'dbname'   => $dbname,
  'username' => $username,
  'password' => $password,
  'charset'  => $charset,
];
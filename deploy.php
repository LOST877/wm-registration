<?php
$secret = getenv('GITHUB_WEBHOOK_SECRET');
$payload = file_get_contents('php://input');
$signature = 'sha256=' . hash_hmac('sha256', $payload, $secret);

if (!hash_equals($signature, $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '')) {
    http_response_code(403);
    exit('Forbidden');
}

$data = json_decode($payload, true);
if (($data['ref'] ?? '') !== 'refs/heads/main') {
    http_response_code(200);
    exit('Not main');
}

$dir = escapeshellarg(__DIR__);
$cmd = "cd $dir && git pull origin main 2>&1";
$output = '';

if (function_exists('exec') && !in_array('exec', array_map('trim', explode(',', ini_get('disable_functions'))))) {
    exec($cmd, $lines, $code);
    $output = implode("\n", $lines) . "\nexit: $code";
} elseif (function_exists('shell_exec')) {
    $output = shell_exec($cmd) ?? 'shell_exec returned null';
} elseif (function_exists('passthru')) {
    ob_start();
    passthru($cmd);
    $output = ob_get_clean();
} elseif (function_exists('system')) {
    ob_start();
    system($cmd);
    $output = ob_get_clean();
} else {
    $output = 'ERROR: all shell functions disabled';
}

$log = date('Y-m-d H:i:s') . "\n" . $output . "\n---\n";
file_put_contents(__DIR__ . '/deploy.log', $log, FILE_APPEND);

http_response_code(200);
echo $output;

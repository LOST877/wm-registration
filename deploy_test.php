<?php
$secret = getenv('GITHUB_WEBHOOK_SECRET');
$payload = file_get_contents('php://input');
$signature = 'sha256=' . hash_hmac('sha256', $payload, $secret);

if (!hash_equals($signature, $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '')) {
    http_response_code(403);
    exit('Forbidden');
}

$data = json_decode($payload, true);
if (($data['ref'] ?? '') !== 'refs/heads/develop') {
    http_response_code(200);
    exit('Not develop');
}

$dir = escapeshellarg(__DIR__);
$cmd = "git -C $dir fetch origin develop 2>&1 && git -C $dir reset --hard origin/develop 2>&1";

exec($cmd, $lines, $code);
$output = implode("\n", $lines) . "\nexit: $code";

$log = date('Y-m-d H:i:s') . "\n" . $output . "\n---\n";
file_put_contents(__DIR__ . '/deploy.log', $log, FILE_APPEND);

http_response_code(200);
echo $output;

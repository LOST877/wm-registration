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

$output = shell_exec('cd ' . escapeshellarg(__DIR__) . ' && git pull origin main 2>&1');
http_response_code(200);
echo $output;

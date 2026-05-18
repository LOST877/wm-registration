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

$keyPath = getenv('GITHUB_DEPLOY_KEY');
$sshCmd  = "ssh -i $keyPath -o StrictHostKeyChecking=no -o BatchMode=yes";
$dir     = escapeshellarg(__DIR__);
$cmd     = "GIT_SSH_COMMAND=" . escapeshellarg($sshCmd) . " git -C $dir pull origin main 2>&1";

exec($cmd, $lines, $code);
$output = implode("\n", $lines) . "\nexit: $code";

$log = date('Y-m-d H:i:s') . "\n" . $output . "\n---\n";
file_put_contents(__DIR__ . '/deploy.log', $log, FILE_APPEND);

http_response_code(200);
echo $output;

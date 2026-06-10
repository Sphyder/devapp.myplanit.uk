<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';
header('Content-Type: application/json');
require_auth();
exit(json_encode(['csrf_token' => csrf_token()]));

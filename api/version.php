<?php
require __DIR__ . '/config.php';
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store');
exit(json_encode(['version' => APP_VERSION, 'env' => APP_ENV]));

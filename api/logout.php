<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';

$_SESSION = [];
session_destroy();
setcookie(session_name(), '', time() - 3600, '/');

header('Location: /login.html');
exit;

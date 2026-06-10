<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

// Shared surveyor account
if ($username === SURVEY_APP_USER && password_verify($password, SURVEY_APP_PASS_HASH)) {
    session_regenerate_id(true);
    $_SESSION['survey_user'] = $username;
    $_SESSION['csrf_token']  = bin2hex(random_bytes(32));
    exit(json_encode(['ok' => true]));
}

// Per-user email + password from access table
if (filter_var($username, FILTER_VALIDATE_EMAIL)) {
    $safe_email = safe(strtolower($username));
    $q    = sql("SELECT `id`, `email`, `password` FROM `access` WHERE `email` = '$safe_email' AND `status` = 1 LIMIT 1");
    $user = mysqli_fetch_assoc($q);
    if ($user && !empty($user['password']) && password_verify($password, $user['password'])) {
        session_regenerate_id(true);
        $_SESSION['survey_user'] = $user['email'];
        $_SESSION['csrf_token']  = bin2hex(random_bytes(32));
        exit(json_encode(['ok' => true]));
    }
}

http_response_code(401);
exit(json_encode(['error' => 'Invalid username or password']));

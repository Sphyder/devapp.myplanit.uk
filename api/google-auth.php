<?php
/**
 * Initiates Google OAuth — redirects to Google's authorisation URL.
 * The state param is a session-stored nonce to prevent CSRF.
 */
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';

$nonce = bin2hex(random_bytes(16));
$_SESSION['google_oauth_state'] = $nonce;

$params = http_build_query([
    'client_id'     => _GOOGLE_CLIENT_ID_,
    'redirect_uri'  => _GOOGLE_REDIRECT_URI_,
    'response_type' => 'code',
    'scope'         => 'openid email profile',
    'state'         => $nonce,
    'prompt'        => 'select_account',
]);

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
exit;

<?php
/**
 * Initiates Microsoft OAuth — redirects to Microsoft's authorisation URL.
 * The state param is a session-stored nonce to prevent CSRF.
 */
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';

$nonce = bin2hex(random_bytes(16));
$_SESSION['ms_oauth_state'] = $nonce;

$params = http_build_query([
    'client_id'     => _MS_CLIENT_ID_,
    'redirect_uri'  => _MS_REDIRECT_URI_,
    'response_type' => 'code',
    'scope'         => 'openid email profile User.Read',
    'state'         => $nonce,
    'response_mode' => 'query',
    'prompt'        => 'select_account',
]);

header('Location: https://login.microsoftonline.com/' . _MS_TENANT_ . '/oauth2/v2.0/authorize?' . $params);
exit;

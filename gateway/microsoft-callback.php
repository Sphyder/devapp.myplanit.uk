<?php
/**
 * Microsoft OAuth callback for devapp.myplanit.uk
 * Registered redirect URI: https://devapp.myplanit.uk/gateway/microsoft-callback.php
 */
ini_set('error_log', __DIR__ . '/../api/.errors');
require __DIR__ . '/../api/config.php';

function fail(string $reason): void {
    header('Location: /login.html?err=' . urlencode($reason));
    exit;
}

// ── Error from Microsoft ──────────────────────────────────────────────────────
if (isset($_GET['error'])) fail('ms_denied');

// ── Missing code ──────────────────────────────────────────────────────────────
if (empty($_GET['code'])) fail('ms_no_code');

// ── CSRF state check ──────────────────────────────────────────────────────────
$state = $_GET['state'] ?? '';
if (!$state || empty($_SESSION['ms_oauth_state']) || !hash_equals($_SESSION['ms_oauth_state'], $state)) {
    fail('invalid_state');
}
unset($_SESSION['ms_oauth_state']);

// ── Exchange authorisation code for access token ──────────────────────────────
$ch = curl_init('https://login.microsoftonline.com/' . _MS_TENANT_ . '/oauth2/v2.0/token');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'code'          => $_GET['code'],
        'client_id'     => _MS_CLIENT_ID_,
        'client_secret' => _MS_CLIENT_SECRET_,
        'redirect_uri'  => _MS_REDIRECT_URI_,
        'grant_type'    => 'authorization_code',
        'scope'         => 'openid email profile User.Read',
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
]);
$token_response = curl_exec($ch);
curl_close($ch);

$token_data = json_decode($token_response, true);
if (empty($token_data['access_token'])) fail('ms_token_failed');

// ── Fetch user profile from Microsoft Graph ───────────────────────────────────
$ch = curl_init('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token_data['access_token']],
]);
$user_response = curl_exec($ch);
curl_close($ch);

$ms_user = json_decode($user_response, true);
$email   = strtolower(trim($ms_user['mail'] ?? $ms_user['userPrincipalName'] ?? ''));

if (!$email) fail('no_email');

// ── Check email against access table ─────────────────────────────────────────
$safe_email = safe($email);
$query      = sql("SELECT * FROM `access` WHERE `email` = '$safe_email' AND `status` = 1 LIMIT 1");
$result     = mysqli_fetch_assoc($query);

if (!$result) fail('no_account');

// ── Create survey session ─────────────────────────────────────────────────────
session_regenerate_id(true);
$_SESSION['survey_user'] = $result['email'];
$_SESSION['csrf_token']  = bin2hex(random_bytes(32));

header('Location: /');
exit;

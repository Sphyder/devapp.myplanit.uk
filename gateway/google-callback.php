<?php
/**
 * Google OAuth callback for devapp.myplanit.uk
 * Registered redirect URI: https://devapp.myplanit.uk/gateway/google-callback.php
 */
ini_set('error_log', __DIR__ . '/../api/.errors');
require __DIR__ . '/../api/config.php';

function fail(string $reason): void {
    header('Location: /login.html?err=' . urlencode($reason));
    exit;
}

// ── Error from Google ────────────────────────────────────────────────────────
if (isset($_GET['error'])) fail('google_denied');

// ── Missing code ─────────────────────────────────────────────────────────────
if (empty($_GET['code'])) fail('no_code');

// ── CSRF state check ─────────────────────────────────────────────────────────
$state = $_GET['state'] ?? '';
if (!$state || empty($_SESSION['google_oauth_state']) || !hash_equals($_SESSION['google_oauth_state'], $state)) {
    fail('invalid_state');
}
unset($_SESSION['google_oauth_state']);

// ── Exchange authorisation code for access token ─────────────────────────────
$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'code'          => $_GET['code'],
        'client_id'     => _GOOGLE_CLIENT_ID_,
        'client_secret' => _GOOGLE_CLIENT_SECRET_,
        'redirect_uri'  => _GOOGLE_REDIRECT_URI_,
        'grant_type'    => 'authorization_code',
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
]);
$token_response = curl_exec($ch);
curl_close($ch);

$token_data = json_decode($token_response, true);
if (empty($token_data['access_token'])) fail('token_failed');

// ── Fetch Google user profile ─────────────────────────────────────────────────
$ch = curl_init('https://www.googleapis.com/oauth2/v2/userinfo');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token_data['access_token']],
]);
$user_response = curl_exec($ch);
curl_close($ch);

$google_user = json_decode($user_response, true);
$email       = strtolower(trim($google_user['email'] ?? ''));

if (!$email) fail('no_email');

// ── Check email against bcos_dev access table ─────────────────────────────────
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

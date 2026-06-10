<?php
ini_set('error_log', __DIR__ . '/api/.errors');
require __DIR__ . '/api/config.php';

if (!empty($_SESSION['survey_user'])) {
    header('Location: /');
    exit;
}

$error = '';
$pin   = '';
$valid = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pin      = trim($_POST['pin'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm  = $_POST['password_confirm'] ?? '';

    if (!$pin || !$password || !$confirm) {
        $error = 'All fields are required.';
    } elseif ($password !== $confirm) {
        $error = 'Passwords do not match.';
    } elseif (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters.';
    } else {
        $safe_pin = safe($pin);
        $q    = sql("SELECT `id` FROM `access` WHERE `pin` = '$safe_pin' AND `status` = 1 LIMIT 1");
        $user = mysqli_fetch_assoc($q);
        if (!$user) {
            header('Location: /forgot-password.php?err=expired');
            exit;
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $safe_hash = safe($hash);
        sql("UPDATE `access` SET `password` = '$safe_hash', `pin` = NULL WHERE `id` = {$user['id']} LIMIT 1");
        header('Location: /login.html?msg=password_changed');
        exit;
    }
    $valid = true; // pin present in POST even if there's an error
} else {
    $pin = trim($_GET['r'] ?? '');
    if ($pin) {
        $safe_pin = safe($pin);
        $q    = sql("SELECT `id` FROM `access` WHERE `pin` = '$safe_pin' AND `status` = 1 LIMIT 1");
        $valid = (bool) mysqli_fetch_assoc($q);
    }
    if (!$valid) {
        header('Location: /forgot-password.php?err=expired');
        exit;
    }
}
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3f3f3f">
    <title>BCOS</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wdth,wght@87.5,100..900&display=swap');
        :root {
            --green: #c1ce41;
            --green-dark: #727a27;
            --dark: #3f3f3f;
            --bg: #e8e8e8;
            --white: #ffffff;
            --border: #6a725d;
            --text: #2f2f2f;
            --text-muted: #666666;
            --red: #af3e2a;
            --radius: 4px;
            --shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: "Roboto", sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .card { background: var(--white); border-radius: var(--radius); box-shadow: var(--shadow); width: 100%; max-width: 380px; overflow: hidden; }
        .card-header { background: var(--dark); color: var(--white); padding: 24px 24px 20px; text-align: center; }
        .card-header h1 { font-size: 1.2rem; font-weight: 700; letter-spacing: 0.04em; }
        .card-header p  { font-size: 0.8rem; opacity: 0.6; margin-top: 4px; }
        .card-body { padding: 24px; }
        .field { margin-bottom: 18px; }
        .field label { display: block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 6px; }
        .field input { width: 100%; padding: 12px 14px; font-size: 1rem; border: 2px solid var(--border); border-radius: var(--radius); outline: none; -webkit-appearance: none; font-family: inherit; }
        .field input:focus { border-color: var(--green-dark); }
        .btn-submit { width: 100%; padding: 14px; background: linear-gradient(to bottom, rgba(140,153,48,1) 0%, rgba(193,206,65,1) 100%); color: var(--white); border: none; border-radius: var(--radius); font-size: 1rem; font-weight: 700; cursor: pointer; letter-spacing: 0.04em; }
        .btn-submit:active { opacity: 0.85; }
        .alert-error { background: #fdecea; border: 1px solid var(--red); color: var(--red); border-radius: var(--radius); padding: 10px 14px; font-size: 0.9rem; margin-bottom: 16px; }
        .back-link { margin-top: 18px; text-align: center; font-size: 0.85rem; }
        .back-link a { color: var(--green-dark); text-decoration: none; font-weight: 600; }
        .back-link a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <div class="card-header">
            <h1>BCOS</h1>
            <p>Set a new password</p>
        </div>
        <div class="card-body">
            <?php if ($error): ?>
                <div class="alert-error"><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>
            <form method="POST" action="/reset-password.php">
                <input type="hidden" name="pin" value="<?= htmlspecialchars($pin) ?>">
                <div class="field">
                    <label>New password</label>
                    <input type="password" name="password" autocomplete="new-password" minlength="8" required autofocus>
                </div>
                <div class="field">
                    <label>Confirm password</label>
                    <input type="password" name="password_confirm" autocomplete="new-password" minlength="8" required>
                </div>
                <button type="submit" class="btn-submit">Set Password</button>
            </form>
            <div class="back-link"><a href="/login.html">← Back to sign in</a></div>
        </div>
    </div>
</body>
</html>

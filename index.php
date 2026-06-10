<?php
ini_set('error_log', __DIR__ . '/.errors');
ini_set('session.cookie_httponly', 1);
ini_set('session.use_strict_mode', 1);
session_name('survey_session');
session_start();

if (empty($_SESSION['survey_user'])) {
    header('Location: /login.html');
    exit;
}

define('APP_VERSION', '1.0.0');
define('APP_ENV', 'development'); // LIVE DEPLOYMENT: change to 'production'

$version = APP_VERSION;
$is_dev  = APP_ENV === 'development';
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#3f3f3f">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Site Survey">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/icons/icon-192.png">
    <title>BCOS Site Survey</title>
    <link rel="stylesheet" href="/styles.css?v=<?= $version ?>">
</head>
<body>
    <div id="online-bar" class="online">Online</div>

    <header id="app-header">
        <div class="header-inner">
            <button id="btn-back" class="btn-icon hidden">&#8592;</button>
            <h1 id="app-title">Site Survey</h1>
            <div id="sync-badge" style="display:none" onclick="showPendingView()" title="Pending surveys">0</div>
        </div>
    </header>

    <main id="app-main" style="padding-bottom:40px">
        <div style="text-align:center;padding:60px 16px;color:#999">
            <div class="spinner"></div>
            <p style="margin-top:16px">Loading…</p>
        </div>
    </main>

    <div id="toast" class="hidden"></div>

    <footer style="text-align:center;font-size:0.75rem;color:#999;padding:24px 16px 16px">
        &copy; <script>document.write(new Date().getFullYear())</script> Cirrus Design Studio Ltd<br>
        <span id="app-version-display" style="color:#777"></span>
<?php if ($is_dev): ?>
        <br><br>
        <a href="/api/logout.php" class="btn btn-outline btn-sm" style="display:inline-block;margin-top:4px;text-decoration:none;font-size:0.8rem;padding:6px 16px">
            Sign Out
        </a>
        <br><span style="color:#f9a825;font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Development Environment</span>
<?php endif; ?>
    </footer>

    <script>
        const APP_VERSION = '<?= $version ?>';
        const APP_ENV     = '<?= APP_ENV ?>';
        const IS_DEV      = APP_ENV === 'development';
    </script>
    <script src="/db.js?v=<?= $version ?>"></script>
    <script src="/sync.js?v=<?= $version ?>"></script>
    <script src="/app.js?v=<?= $version ?>"></script>
</body>
</html>

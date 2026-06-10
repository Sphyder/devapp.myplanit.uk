<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';
header('Content-Type: application/json');
require_auth();

$encryptedID = $_GET['app'] ?? '';
$appID       = do_crypt($encryptedID, 'd');
if (!$appID) {
    http_response_code(400);
    exit(json_encode(['error' => 'Invalid application ID']));
}
$appID_safe = safe($appID);

$query = sql("SELECT a.*, ac.cronCommenced
FROM `applications` a
LEFT JOIN `application_cron` ac ON ac.`cronAppID` = a.`appID`
WHERE a.`appID` = '$appID_safe'
LIMIT 1");

$app = mysqli_fetch_assoc($query);
if (!$app) {
    http_response_code(404);
    exit(json_encode(['error' => 'Application not found']));
}

exit(json_encode([
    'encryptedID'       => $encryptedID,
    'appNumber'         => $app['appNumber'],
    'appAdd1'           => $app['siteAdd1'],
    'appAdd2'           => $app['siteAdd2'],
    'appTown'           => $app['siteTown'],
    'appCounty'         => $app['siteCounty'],
    'appPostcode'       => $app['sitePostcode'],
    'appPlots'          => (int)($app['appPlots'] ?? 1),
    'appPlanCheckLevel' => $app['appPlanCheckLevel'] ?? 'low',
    'hasCommenced'      => !empty($app['cronCommenced']),
    'appFlagStatus'     => $app['appFlagStatus'],
    'contName'          => $app['contName'] ?? '',
    'contEmail'         => $app['contEmail'] ?? '',
    'contTelephone'     => $app['contTelephone'] ?? '',
    'contAdd1'          => $app['contAdd1'] ?? '',
    'contAdd2'          => $app['contAdd2'] ?? '',
    'contTown'          => $app['contTown'] ?? '',
    'contCounty'        => $app['contCounty'] ?? '',
    'contPostcode'      => $app['contPostcode'] ?? '',
    'appConductedEmail' => $app['appConductedEmail'] ?? '0',
    'loadedAt'          => time(),
]));

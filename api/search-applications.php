<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';
header('Content-Type: application/json');
require_auth();

$q_raw = $_GET['q'] ?? '';
if (strlen($q_raw) < 2) exit(json_encode([]));

$q        = safe($q_raw);
$complete = _APPLICATION_COMPLETE_;

$query = sql("SELECT `appID`, `appNumber`, `siteAdd1`, `siteTown`, `appPlots`
FROM `applications`
WHERE (`appNumber` LIKE '%$q%' OR `siteAdd1` LIKE '%$q%' OR `siteTown` LIKE '%$q%')
AND `appFlagStatus` != '$complete'
ORDER BY `appID` DESC
LIMIT 20");

$results = [];
while ($row = mysqli_fetch_assoc($query)) {
    $results[] = [
        'encryptedID' => do_crypt((string)$row['appID'], 'e'),
        'appNumber'   => $row['appNumber'],
        'address'     => trim($row['siteAdd1'] . ', ' . $row['siteTown'], ', '),
        'appPlots'    => (int)$row['appPlots'],
    ];
}
exit(json_encode($results));

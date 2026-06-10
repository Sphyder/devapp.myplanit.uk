<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';
header('Content-Type: application/json');
require_auth();

$encryptedID = $_GET['app'] ?? '';
$appID       = (int)do_crypt($encryptedID, 'd');
if (!$appID) {
    http_response_code(400);
    exit(json_encode(['error' => 'Invalid application ID']));
}

$query = sql("SELECT d.defDate, d.defResolved, d.defFixedBy, l.defectContent
FROM survey_defects d
LEFT JOIN survey_defects_list l ON l.defectID = d.defItemID
WHERE d.defAppID = '$appID'
GROUP BY l.defectID
ORDER BY d.defDate DESC");

$defects = [];
while ($row = mysqli_fetch_assoc($query)) {
    $defects[] = [
        'date'     => $row['defDate'],
        'content'  => $row['defectContent'],
        'resolved' => (int)$row['defResolved'],
        'fixedBy'  => $row['defFixedBy'] > 0 ? get_user((int)$row['defFixedBy']) : null,
    ];
}
exit(json_encode($defects));

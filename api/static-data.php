<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';
header('Content-Type: application/json');
require_auth();

$defects = [];
$q = sql("SELECT `defectID`, `defectContent`, `defectLevel`, `defectPID`
FROM `survey_defects_list`
WHERE `defectStatus` = 1
ORDER BY `defectLevel` ASC, `defectContent` ASC");
while ($row = mysqli_fetch_assoc($q)) {
    $defects[] = ['id' => (int)$row['defectID'], 'text' => $row['defectContent'], 'level' => (int)$row['defectLevel'], 'pid' => (int)$row['defectPID']];
}

$advisories = [];
$q = sql("SELECT `advID`, `advisoryContent`, `advisoryLevel`, `advisoryPID`
FROM `survey_advisory_list`
WHERE `advisoryStatus` = 1
ORDER BY `advisoryLevel` ASC, `advisoryContent` ASC");
while ($row = mysqli_fetch_assoc($q)) {
    $advisories[] = ['id' => (int)$row['advID'], 'text' => $row['advisoryContent'], 'level' => (int)$row['advisoryLevel'], 'pid' => (int)$row['advisoryPID']];
}

$inspection_types = [];
$q = sql("SELECT `id`, `name` FROM `variables` WHERE `pid` = 6 AND `status` = 1 ORDER BY `position` ASC");
while ($row = mysqli_fetch_assoc($q)) {
    $inspection_types[] = ['id' => (int)$row['id'], 'name' => $row['name']];
}

$noshow = [1, 2, 3, 5, 23, 25, 67, 76, 77, 78, 79];
$staff  = [];
$q = sql("SELECT `id`, `name` FROM `access` WHERE `status` = 1 ORDER BY `name`");
while ($row = mysqli_fetch_assoc($q)) {
    if (!in_array((int)$row['id'], $noshow)) {
        $staff[] = ['id' => (int)$row['id'], 'name' => string_val($row['name']) ?? $row['name']];
    }
}

exit(json_encode([
    'defects'             => $defects,
    'advisories'          => $advisories,
    'inspection_types'    => $inspection_types,
    'staff'               => $staff,
    'weather'             => [1 => 'Dry', 2 => 'Dry / overcast', 3 => 'Dry / sunny', 4 => 'Frosty', 5 => 'Heavy rain', 6 => 'Light rain', 7 => 'Rain', 8 => 'Snow'],
    'application_types'   => [1 => 'Building Control', 2 => 'Warranty', 3 => 'Building Control & Warranty'],
    'supervising_methods' => [0 => 'Unknown', 1 => 'Onsite With Surveyor', 2 => 'Video Recorded', 3 => 'Photographs', 4 => 'Live Video Link', 5 => 'SIR Review', 6 => 'Onsite', 7 => 'Not required'],
    'inspection_methods'  => [0 => 'Onsite', 1 => 'Live Video Link (Remote)', 2 => 'Video Recorded (Remote)', 3 => 'Photographs (Remote)'],
    'cachedAt'            => time(),
    'version'             => APP_VERSION,
]));

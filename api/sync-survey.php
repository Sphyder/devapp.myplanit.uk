<?php
ini_set('error_log', __DIR__ . '/.errors');
require __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

require_auth();

// CSRF check
$submitted_token = $_POST['csrf_token'] ?? '';
if (!hash_equals(csrf_token(), $submitted_token)) {
    http_response_code(403);
    exit(json_encode(['error' => 'Invalid CSRF token']));
}

if (($_POST['method'] ?? '') !== 'add_survey') {
    http_response_code(400);
    exit(json_encode(['error' => 'Unknown method']));
}

// ── Validate required fields ─────────────────────────────────────────────────
$surReport = trim($_POST['surReport'] ?? '');
if ($surReport === '') {
    http_response_code(422);
    exit(json_encode(['error' => 'Survey report is required']));
}

$encryptedAppID = $_POST['appID'] ?? '';
$surAppID       = (int)do_crypt($encryptedAppID, 'd');
if (!$surAppID) {
    http_response_code(400);
    exit(json_encode(['error' => 'Invalid application ID']));
}

// ── Build survey record ──────────────────────────────────────────────────────
$surID              = uuid(32);
$surUserID          = 0; // Standalone: no BCOS user ID; 0 indicates API submission
$surAppType         = safe($_POST['application_type']   ?? 0);
$surInspectionType  = safe($_POST['inspection_type']    ?? 0);
$surWeather         = safe($_POST['weather']            ?? 0);
$surPlots           = safe($_POST['surPlots']           ?? '1');
$surEntered         = safe($_POST['surveyDate']         ?? date('Y-m-d'));
$surStart           = safe(($_POST['startTime'] ?? '00:00') . ':00');
$surEnd             = safe(($_POST['surEnd']    ?? '00:00') . ':00');
$surOvertime        = safe($_POST['surOvertime']        ?? '');
$surReport_safe     = safe($surReport);
$surOtherDefect     = safe($_POST['surOtherDefect']     ?? '');
$supervising_method = safe($_POST['supervisor_method']  ?? 0);
$supervisor         = safe($_POST['supervisor']         ?? 0);
$inspection_method  = safe($_POST['inspection_method']  ?? 0);
$surStatus          = 1;
$surUpdated         = date('Y-m-d H:i:s');
$surReminder        = '';
$reminderDays       = (int)($_POST['reminder'] ?? 21);
if ($reminderDays >= 1) {
    $surReminder = date('Y-m-d', strtotime('+' . $reminderDays . ' day', strtotime($surEntered)));
}

// Contractor details
$contName      = safe($_POST['contName']       ?? '');
$contEmail     = safe($_POST['contEmail']      ?? '');
$contTelephone = safe(formatTelephone($_POST['contTelephone'] ?? ''));
$contAdd1      = safe($_POST['contAdd1']       ?? '');
$contAdd2      = safe($_POST['contAdd2']       ?? '');
$contTown      = safe($_POST['contTown']       ?? '');
$contCounty    = safe($_POST['contCounty']     ?? '');
$contPostcode  = safe(postcode($_POST['contPostcode'] ?? '') ?? '');
$appConductedEmail = safe($_POST['appConductedEmail'] ?? '0');

// ── Insert survey ────────────────────────────────────────────────────────────
sql("INSERT INTO `surveys` (
    `surID`, `surStatus`, `surAppID`, `surUserID`,
    `surAppType`, `surInspectionType`, `surWeather`, `surPlots`,
    `surUpdated`, `surEntered`, `surReminder`, `surStart`, `surEnd`,
    `surOvertime`, `surReport`, `surOtherDefect`,
    `supervising_method`, `supervisor`, `inspection_method`
) VALUES (
    '$surID', '$surStatus', '$surAppID', '$surUserID',
    '$surAppType', '$surInspectionType', '$surWeather', '$surPlots',
    '$surUpdated', '$surEntered', '$surReminder', '$surStart', '$surEnd',
    '$surOvertime', '$surReport_safe', '$surOtherDefect',
    '$supervising_method', '$supervisor', '$inspection_method'
)");

// ── Update contractor details on application ─────────────────────────────────
sql("UPDATE `applications` SET
    `contName`          = '$contName',
    `contEmail`         = '$contEmail',
    `contTelephone`     = '$contTelephone',
    `appConductedEmail` = '$appConductedEmail',
    `contAdd1`          = '$contAdd1',
    `contAdd2`          = '$contAdd2',
    `contTown`          = '$contTown',
    `contCounty`        = '$contCounty',
    `contPostcode`      = '$contPostcode'
WHERE `appID` = '$surAppID' LIMIT 1");

// ── 21-day reminder ───────────────────────────────────────────────────────────
$reminder21 = date('Y-m-d', strtotime('+21 day', strtotime($surEntered)));
sql("INSERT INTO `21_day_reminder` (`application`, `reminder`) VALUES ('$surAppID', '$reminder21')
ON DUPLICATE KEY UPDATE `reminder` = '$reminder21'");

// ── Application ticks (create default row if missing) ────────────────────────
if (mysqli_num_rows(sql("SELECT `tickAppID` FROM `application_ticks` WHERE `tickAppID` = $surAppID")) === 0) {
    sql("INSERT INTO `application_ticks` (`tickAppID`) VALUES ('$surAppID')");
}

$tick_q = sql("SELECT `ticksNSIR_ticked` FROM `application_ticks` WHERE `tickAppID` = '$surAppID' LIMIT 1");
$tick_r = mysqli_fetch_assoc($tick_q);
$ticksNSIR = rtrim($surInspectionType . ',' . ($tick_r['ticksNSIR_ticked'] ?? ''), ',');
sql("UPDATE `application_ticks` SET `ticksNSIR_ticked` = '$ticksNSIR' WHERE `tickAppID` = '$surAppID' LIMIT 1");

// ── Commencement inspection (type 13) ────────────────────────────────────────
if ((int)$surInspectionType === _APPLICATION_COMMENCEMENT_) {
    sql("UPDATE `applications` SET `appSiteBoard` = 5 WHERE `appID` = '$surAppID' LIMIT 1");
    $commenced = date('Y-m-d');
    sql("INSERT INTO `application_cron` (`cronAppID`, `cronCommenced`) VALUES ('$surAppID', '$commenced')
    ON DUPLICATE KEY UPDATE `cronCommenced` = '$commenced'");
    // NOTE: Commencement email notifications are suppressed in the dev environment.
}

// ── Defects ───────────────────────────────────────────────────────────────────
$defItemID = trim($_POST['defItemID'] ?? '');
if ($defItemID !== '') {
    foreach (explode(',', $defItemID) as $dID) {
        $dID = (int)$dID;
        if ($dID > 0) {
            sql("INSERT INTO `survey_defects` (
                `defSurID`, `defAppID`, `defItemID`, `defDate`, `defResolution`, `defResolved`, `defUserID`, `defFixed`
            ) VALUES (
                '$surID', '$surAppID', '$dID', '$surEntered', 0, 0, '$surUserID', '0000-00-00'
            )");
        }
    }
}

// ── Advisories ────────────────────────────────────────────────────────────────
$advisoryItemID = trim($_POST['advisoryItemID'] ?? '');
if ($advisoryItemID !== '') {
    foreach (explode(',', $advisoryItemID) as $aID) {
        $aID = (int)$aID;
        if ($aID > 0) {
            sql("INSERT INTO `survey_advisory` (
                `advisorySurID`, `advisoryAppID`, `advisoryItemID`, `advisoryDate`, `advisoryResolution`, `advisoryResolved`, `advisoryUserID`, `advisoryFixed`
            ) VALUES (
                '$surID', '$surAppID', '$aID', '$surEntered', 0, 0, '$surUserID', '0000-00-00'
            )");
        }
    }
}

// ── Photo uploads ─────────────────────────────────────────────────────────────
$acceptable_mime = unserialize(ACCEPTABLE_MIME);
$upload_dir      = __DIR__ . '/../uploads/' . $surAppID;
if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);

$uploaded_files = [];
if (!empty($_FILES['upload']['name'])) {
    $total = count($_FILES['upload']['name']);
    for ($i = 0; $i < $total; $i++) {
        $fileType    = $_FILES['upload']['type'][$i]    ?? '';
        $fileTmpName = $_FILES['upload']['tmp_name'][$i] ?? '';
        $fileSize    = (int)($_FILES['upload']['size'][$i] ?? 0);
        $fileOldName = $_FILES['upload']['name'][$i]    ?? '';

        if (!in_array($fileType, $acceptable_mime) || !is_uploaded_file($fileTmpName)) continue;

        $ext         = strtolower(pathinfo($fileOldName, PATHINFO_EXTENSION));
        $fileID      = uuid(32);
        $base        = pathinfo($fileOldName, PATHINFO_FILENAME);
        $fileNewName = slug($base) . '.' . $ext;
        $dest        = $upload_dir . '/' . $fileNewName;

        if (file_exists($dest)) {
            unlink($dest);
            $fileID_safe      = safe($fileID);
            $fileNewName_safe = safe($fileNewName);
            sql("DELETE FROM `filemanager` WHERE `fileNewName` = '$fileNewName_safe' AND `fileAppID` = '$surAppID'");
        }

        if (move_uploaded_file($fileTmpName, $dest)) {
            $fileID_s      = safe($fileID);
            $fileOldName_s = safe($fileOldName);
            $fileNewName_s = safe($fileNewName);
            $fileType_s    = safe($fileType);
            $fileUploaded  = date('Y-m-d H:i:s');
            $fileDirID     = _DEFAULT_SITE_REPORT_DIRECTORY_;

            sql("INSERT INTO `filemanager` (
                `fileID`, `fileStatus`, `fileAppID`, `fileDirID`, `fileUploadedBy`,
                `fileSize`, `fileType`, `fileUploaded`, `fileOldName`, `fileNewName`, `fileSurID`
            ) VALUES (
                '$fileID_s', 1, '$surAppID', '$fileDirID', '$surUserID',
                '$fileSize', '$fileType_s', '$fileUploaded', '$fileOldName_s', '$fileNewName_s', '$surID'
            )");
            $uploaded_files[] = $fileNewName;
        }
    }
}

exit(json_encode([
    'ok'       => true,
    'surID'    => $surID,
    'uploaded' => $uploaded_files,
]));

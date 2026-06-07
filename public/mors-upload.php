<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { echo json_encode(['error' => 'POST only']); exit; }

$uploadDir = __DIR__ . '/files/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

if (empty($_FILES['file'])) { echo json_encode(['error' => 'No file received']); exit; }

$orig = basename($_FILES['file']['name']);
$ext  = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
$safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($orig, PATHINFO_FILENAME));
$name = date('Ymd_His') . '_' . $safe . '.' . $ext;
$dest = $uploadDir . $name;

$allowed = ['pdf','doc','docx','xls','xlsx','ppt','pptx','png','jpg','jpeg','gif','txt','csv','zip'];
if (!in_array($ext, $allowed)) { echo json_encode(['error' => 'File type not allowed']); exit; }
if ($_FILES['file']['size'] > 20 * 1024 * 1024) { echo json_encode(['error' => 'File too large (20MB max)']); exit; }

if (!move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
    echo json_encode(['error' => 'Upload failed']); exit;
}

$host = 'https://bluhon.com/mors/files/' . $name;
echo json_encode(['url' => $host, 'name' => $orig, 'size' => $_FILES['file']['size']]);

<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST method is allowed');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid input data');
    }
    
    // Create data directory if it doesn't exist
    $dataDir = __DIR__ . '/../../data';
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }
    
    // Save the listing attempt
    $listingAttemptsFile = $dataDir . '/listing_attempts.json';
    $attempts = [];
    
    if (file_exists($listingAttemptsFile)) {
        $attempts = json_decode(file_get_contents($listingAttemptsFile), true) ?: [];
    }
    
    $attempts[] = $input;
    file_put_contents($listingAttemptsFile, json_encode($attempts, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'message' => 'Listing attempt tracked'
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 
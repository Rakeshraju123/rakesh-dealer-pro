<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('Only GET method is allowed');
    }
    
    // Path to the JSON file
    $jsonFile = __DIR__ . '/../data/listed_trailers.json';
    
    // Read existing data
    $listedTrailers = [];
    if (file_exists($jsonFile)) {
        $jsonContent = file_get_contents($jsonFile);
        if ($jsonContent !== false) {
            $listedTrailers = json_decode($jsonContent, true) ?: [];
        }
    }
    
    echo json_encode([
        'success' => true,
        'data' => $listedTrailers
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
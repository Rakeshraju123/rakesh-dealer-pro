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
    
    if (!$input || !isset($input['stock_number'])) {
        throw new Exception('Stock number is required');
    }
    
    $stockNumber = $input['stock_number'];
    $listedAt = $input['listed_at'] ?? date('Y-m-d H:i:s');
    $platform = $input['platform'] ?? 'Facebook Marketplace';
    $url = $input['url'] ?? '';
    
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
    
    // Add new listing
    $listedTrailers[] = [
        'stock_number' => $stockNumber,
        'listed_at' => $listedAt,
        'platform' => $platform,
        'url' => $url,
        'status' => 'listed'
    ];
    
    // Save updated data
    $result = file_put_contents($jsonFile, json_encode($listedTrailers, JSON_PRETTY_PRINT));
    
    if ($result === false) {
        throw new Exception('Failed to save listing data');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Trailer marked as listed successfully',
        'stock_number' => $stockNumber
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 
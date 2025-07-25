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
    
    if (!$input || $input['action'] !== 'listing_confirmed') {
        throw new Exception('Invalid confirmation data');
    }
    
    $trailerData = $input['trailer_data'];
    $facebookUrl = $input['facebook_url'];
    $timestamp = $input['timestamp'];
    
    // Store the confirmation in a database or file
    $confirmationData = [
        'trailer_stock' => $trailerData['stock_number'],
        'trailer_title' => $trailerData['title'],
        'facebook_url' => $facebookUrl,
        'confirmed_at' => $timestamp,
        'detection_method' => $input['detection_method']
    ];
    
    // Save to database (you'll need to implement this)
    // saveListingConfirmation($confirmationData);
    
    // For now, save to a JSON file
    $confirmationsFile = __DIR__ . '/../../data/listing_confirmations.json';
    $confirmations = [];
    
    if (file_exists($confirmationsFile)) {
        $confirmations = json_decode(file_get_contents($confirmationsFile), true) ?: [];
    }
    
    $confirmations[] = $confirmationData;
    file_put_contents($confirmationsFile, json_encode($confirmations, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'message' => 'Listing confirmation saved',
        'trailer_stock' => $trailerData['stock_number']
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 
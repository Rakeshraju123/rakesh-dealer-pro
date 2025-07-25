<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST method is allowed');
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['stock']) || !isset($input['title'])) {
        throw new Exception('Missing required fields: stock and title');
    }
    
    $stock = $input['stock'];
    $title = $input['title'];
    $listedDate = isset($input['listed_date']) ? $input['listed_date'] : date('c');
    
    // Path to the JSON file
    $jsonFile = __DIR__ . '/../data/listed_trailers.json';
    
    // Create data directory if it doesn't exist
    $dataDir = dirname($jsonFile);
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }
    
    // Read existing data
    $listedTrailers = [];
    if (file_exists($jsonFile)) {
        $jsonContent = file_get_contents($jsonFile);
        if ($jsonContent !== false) {
            $listedTrailers = json_decode($jsonContent, true) ?: [];
        }
    }
    
    // Check if trailer already exists
    $existingIndex = -1;
    foreach ($listedTrailers as $index => $trailer) {
        if ($trailer['stock'] === $stock && $trailer['title'] === $title) {
            $existingIndex = $index;
            break;
        }
    }
    
    // Add or update trailer
    $trailerData = [
        'stock' => $stock,
        'title' => $title,
        'listed_date' => $listedDate
    ];
    
    if ($existingIndex >= 0) {
        // Update existing entry
        $listedTrailers[$existingIndex] = $trailerData;
    } else {
        // Add new entry
        $listedTrailers[] = $trailerData;
    }
    
    // Save back to file
    $result = file_put_contents($jsonFile, json_encode($listedTrailers, JSON_PRETTY_PRINT));
    
    if ($result === false) {
        throw new Exception('Failed to save trailer listing data');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Trailer marked as listed successfully',
        'data' => $trailerData
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 
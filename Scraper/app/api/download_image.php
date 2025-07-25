<?php

require_once __DIR__ . '/../controllers/openAiScraper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $imageUrl = $_GET['url'] ?? $_POST['url'] ?? '';
    $filename = $_GET['filename'] ?? $_POST['filename'] ?? '';
    
    if (empty($imageUrl)) {
        throw new Exception('Image URL is required');
    }
    
    // Validate URL
    if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
        throw new Exception('Invalid image URL');
    }
    
    // Additional security check - only allow http/https URLs
    $urlParts = parse_url($imageUrl);
    if (!in_array($urlParts['scheme'] ?? '', ['http', 'https'])) {
        throw new Exception('Only HTTP and HTTPS URLs are allowed');
    }
    
    // Initialize HTTP client with similar settings as the scraper
    $client = new GuzzleHttp\Client([
        'timeout' => 30,
        'headers' => [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept' => 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language' => 'en-US,en;q=0.9',
            'Referer' => parse_url($imageUrl, PHP_URL_SCHEME) . '://' . parse_url($imageUrl, PHP_URL_HOST) . '/',
        ],
        'verify' => true,
        'allow_redirects' => true
    ]);
    
    // Fetch the image
    $response = $client->get($imageUrl);
    
    if ($response->getStatusCode() !== 200) {
        throw new Exception('Failed to fetch image: HTTP ' . $response->getStatusCode());
    }
    
    $imageData = $response->getBody()->getContents();
    $contentType = $response->getHeader('Content-Type')[0] ?? 'application/octet-stream';
    
    // Determine file extension from content type or URL
    $extension = '';
    if (strpos($contentType, 'jpeg') !== false || strpos($contentType, 'jpg') !== false) {
        $extension = '.jpg';
    } elseif (strpos($contentType, 'png') !== false) {
        $extension = '.png';
    } elseif (strpos($contentType, 'gif') !== false) {
        $extension = '.gif';
    } elseif (strpos($contentType, 'webp') !== false) {
        $extension = '.webp';
    } else {
        // Try to get extension from URL
        $urlPath = parse_url($imageUrl, PHP_URL_PATH);
        $pathExtension = pathinfo($urlPath, PATHINFO_EXTENSION);
        if ($pathExtension) {
            $extension = '.' . strtolower($pathExtension);
        } else {
            $extension = '.jpg'; // Default fallback
        }
    }
    
    // Generate filename if not provided
    if (empty($filename)) {
        $filename = 'trailer_image_' . date('Y-m-d_H-i-s') . '_' . uniqid();
    }
    
    // Clean filename and remove extension if it already has one
    $filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $filename);
    $filename = preg_replace('/\.[^.]+$/', '', $filename);
    $fullFilename = $filename . $extension;
    
    // Set headers for download
    header('Content-Type: ' . $contentType);
    header('Content-Disposition: attachment; filename="' . $fullFilename . '"');
    header('Content-Length: ' . strlen($imageData));
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');
    
    // Output the image data
    echo $imageData;
    
} catch (Exception $e) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} 
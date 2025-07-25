<?php

require_once __DIR__ . '/../controllers/openAiScraper.php';
require_once __DIR__ . '/../controllers/DynamicScraper.php';
require_once __DIR__ . '/../controllers/DotEnvLoader.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

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
    
    if (!$input) {
        // Fallback to POST data
        $input = $_POST;
    }
    
    $urls = $input['urls'] ?? [];
    
    if (empty($urls) || !is_array($urls)) {
        throw new Exception('URLs array is required');
    }
    
    // Validate URLs
    foreach ($urls as $url) {
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new Exception('Invalid URL format: ' . $url);
        }
    }
    
    // Get proxy information
    $proxyConfig = DotEnvLoader::getOxylabsConfig();
    $proxyIp = DotEnvLoader::getProxyIp();
    
    // Initialize scraper
    $scraper = new OpenAiScraper();
    $results = [];
    $errors = [];
    
    // Process each URL
    foreach ($urls as $index => $url) {
        try {
            $result = $scraper->extractTrailerDetails($url);
            $results[] = [
                'url' => $url,
                'index' => $index,
                'success' => true,
                'data' => $result
            ];
        } catch (Exception $e) {
            $errors[] = [
                'url' => $url,
                'index' => $index,
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'results' => $results,
        'errors' => $errors,
        'total_processed' => count($urls),
        'successful' => count($results),
        'failed' => count($errors),
        'proxy_info' => [
            'enabled' => $proxyConfig['enabled'],
            'ip' => $proxyIp,
            'host' => $proxyConfig['host'],
            'port' => $proxyConfig['port'],
            'location' => $proxyConfig['location']
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} 
<?php

require_once __DIR__ . '/../controllers/openAiScraper.php';
require_once __DIR__ . '/../controllers/DynamicScraper.php';

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
    
    $url = $input['url'] ?? '';
    $enableScrolling = $input['enableScrolling'] ?? false;
    
    if (empty($url)) {
        throw new Exception('URL is required');
    }
    
    // Validate URL
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        throw new Exception('Invalid URL format');
    }
    
    // Get proxy information
    $proxyConfig = DotEnvLoader::getOxylabsConfig();
    $proxyIp = DotEnvLoader::getProxyIp();
    
    // Initialize the appropriate scraper based on scrolling preference
    if ($enableScrolling) {
        $scraper = new DynamicScraper();
    } else {
        $scraper = new OpenAiScraper();
    }
    
    // Extract trailer details
    $result = $scraper->extractTrailerDetails($url);
    
    // Add proxy information to response
    $result['proxy_info'] = [
        'enabled' => $proxyConfig['enabled'],
        'ip' => $proxyIp,
        'host' => $proxyConfig['host'],
        'port' => $proxyConfig['port'],
        'location' => $proxyConfig['location']
    ];
    
    echo json_encode([
        'success' => true,
        'data' => $result,
        'scraper_type' => $enableScrolling ? 'dynamic' : 'static',
        'proxy_used' => $proxyConfig['enabled'],
        'proxy_location' => $proxyConfig['location']
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}


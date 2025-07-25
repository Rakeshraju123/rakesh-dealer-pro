<?php

require_once __DIR__ . '/../controllers/DotEnvLoader.php';
require_once __DIR__ . '/../controllers/SessionProxyManager.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Start session to access dealer information
if (session_status() === PHP_SESSION_NONE) {
    session_start();
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
    
    $facebookUrl = $input['facebook_url'] ?? 'https://www.facebook.com/marketplace/create/vehicle';
    $trailerData = $input['trailer_data'] ?? null;
    
    // Get proxy configuration
    $proxyConfig = DotEnvLoader::getOxylabsConfig();
    $proxyIp = DotEnvLoader::getProxyIp(); // This now uses session-based proxy
    
    if (!$proxyConfig['enabled']) {
        throw new Exception('Proxy is not enabled');
    }
    
    // Get session proxy information for enhanced logging
    $sessionProxyInfo = SessionProxyManager::getSessionProxyInfo();
    $dealerId = $_SESSION['dealer_id'] ?? 'anonymous';
    
    error_log("Facebook Proxy Session - Dealer: $dealerId, IP: $proxyIp, Session-based: " . 
              ($sessionProxyInfo ? 'YES' : 'NO'));
    
    // Create a unique session ID for this Facebook session
    $sessionId = uniqid('fb_session_', true);
    
    // Store session data temporarily (you might want to use a database or cache)
    $sessionData = [
        'session_id' => $sessionId,
        'facebook_url' => $facebookUrl,
        'trailer_data' => $trailerData,
        'proxy_config' => [
            'enabled' => $proxyConfig['enabled'],
            'ip' => $proxyIp,
            'host' => $proxyConfig['host'],
            'port' => $proxyConfig['port'],
            'location' => $proxyConfig['location']
        ],
        'created_at' => time()
    ];
    
    // Store session data in a temporary file (in production, use Redis or database)
    $sessionDir = __DIR__ . '/../data/fb_sessions';
    $sessionFile = $sessionDir . '/' . $sessionId . '.json';
    
    // Create directory with proper permissions
    if (!is_dir($sessionDir)) {
        if (!mkdir($sessionDir, 0777, true)) {
            // If mkdir fails, try alternative location
            $sessionDir = sys_get_temp_dir() . '/fb_sessions';
            if (!is_dir($sessionDir)) {
                mkdir($sessionDir, 0777, true);
            }
            $sessionFile = $sessionDir . '/' . $sessionId . '.json';
        }
    }
    
    // Ensure directory is writable
    if (!is_writable($sessionDir)) {
        chmod($sessionDir, 0777);
    }
    
    file_put_contents($sessionFile, json_encode($sessionData));
    
    // Return response with enhanced proxy information
    echo json_encode([
        'success' => true,
        'session_id' => $sessionId,
        'facebook_url' => $facebookUrl,
        'proxy_info' => [
            'enabled' => $proxyConfig['enabled'],
            'ip' => $proxyIp,
            'host' => $proxyConfig['host'],
            'port' => $proxyConfig['port'],
            'location' => $proxyConfig['location'],
            'type' => $sessionProxyInfo ? 'session_persistent' : 'rotating_fallback',
            'dealer_id' => $dealerId,
            'session_based' => $sessionProxyInfo ? true : false
        ],
        'message' => $sessionProxyInfo ? 
            'Facebook session created with session-persistent proxy (prevents account blocks)' :
            'Facebook session created with Kansas City proxy (fallback mode)'
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 
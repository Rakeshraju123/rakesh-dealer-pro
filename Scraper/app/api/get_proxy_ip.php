<?php

require_once __DIR__ . '/../controllers/DotEnvLoader.php';
require_once __DIR__ . '/../controllers/SessionProxyManager.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://dealerpro.matrackinc.com');
header('Access-Control-Allow-Methods: GET, POST');
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
    // Get proxy configuration
    $proxyConfig = DotEnvLoader::getOxylabsConfig();
    
    if (!$proxyConfig['enabled']) {
        throw new Exception('Proxy is not enabled');
    }
    
    // Get current proxy IP (now uses session-based proxy management)
    $proxyIp = DotEnvLoader::getProxyIp();
    
    if (!$proxyIp) {
        throw new Exception('Unable to fetch current proxy IP');
    }
    
    // Get session proxy information
    $sessionProxyInfo = SessionProxyManager::getSessionProxyInfo();
    
    // Test proxy connection to verify it's working
    $proxyTest = DotEnvLoader::testProxyConnection();
    
    // Determine proxy type
    $proxyType = $sessionProxyInfo ? 'session_persistent' : 'rotating_fallback';
    $dealerId = $_SESSION['dealer_id'] ?? 'anonymous';
    
    echo json_encode([
        'success' => true,
        'proxy_info' => [
            'ip' => $proxyIp,
            'location' => $proxyConfig['location'],
            'city' => $proxyConfig['location'] ? ucwords(str_replace('_', ' ', $proxyConfig['location'])) : 'No City Selected',
            'country' => 'United States',
            'org' => 'Oxylabs',
            'host' => $proxyConfig['host'],
            'port' => $proxyConfig['port'],
            'status' => $proxyTest['success'] ? 'active' : 'inactive',
            'response_time' => $proxyTest['response_time'] ?? 0,
            'timestamp' => time(),
            'formatted_time' => date('Y-m-d H:i:s'),
            'type' => $proxyType,
            'dealer_id' => $dealerId,
            'session_info' => $sessionProxyInfo
        ],
        'message' => $proxyType === 'session_persistent' ? 
            'Session-persistent proxy IP (prevents Facebook blocks)' : 
            'Rotating proxy IP (fallback mode)'
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'proxy_info' => [
            'ip' => null,
            'location' => $proxyConfig['location'],
            'city' => $proxyConfig['location'] ? ucwords(str_replace('_', ' ', $proxyConfig['location'])) : 'No City Selected',
            'country' => 'United States',
            'org' => 'Oxylabs',
            'status' => 'error',
            'timestamp' => time(),
            'formatted_time' => date('Y-m-d H:i:s')
        ]
    ]);
}

?> 
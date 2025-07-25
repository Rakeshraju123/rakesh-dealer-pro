<?php
session_start();

// Set JSON response header
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    // Check if dealer is authenticated
    if (!isset($_SESSION['dealer_id']) || !isset($_SESSION['is_authenticated'])) {
        throw new Exception('User not authenticated');
    }
    
    // Load required classes
    require_once __DIR__ . '/../controllers/SessionProxyManager.php';
    require_once __DIR__ . '/../controllers/DotEnvLoader.php';
    
    $dealerId = $_SESSION['dealer_id'];
    
    // Get current state before clearing
    $oldSessionInfo = SessionProxyManager::getSessionProxyInfo();
    $oldCity = $_SESSION['selected_proxy_city'] ?? null;
    $oldIP = $oldSessionInfo['ip'] ?? null;
    
    // Clear proxy session completely
    SessionProxyManager::clearSessionProxyInfo();
    
    // Also clear selected city from session (will be set by the calling code)
    unset($_SESSION['selected_proxy_city']);
    
    // Force a new login time to ensure fresh proxy assignment
    $_SESSION['login_time'] = time();
    
    // Log the action
    error_log("API: Cleared proxy session for dealer $dealerId. Old city: $oldCity, Old IP: $oldIP");
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Proxy session cleared successfully',
        'dealer_id' => $dealerId,
        'cleared_data' => [
            'old_city' => $oldCity,
            'old_ip' => $oldIP,
            'old_location' => $oldSessionInfo['location'] ?? null,
            'old_username' => $oldSessionInfo['unique_username'] ?? null
        ],
        'timestamp' => time(),
        'action' => 'proxy_session_cleared'
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => time()
    ]);
}
?> 
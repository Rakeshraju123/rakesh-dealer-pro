<?php

require_once __DIR__ . '/../controllers/CityProxyManager.php';
require_once __DIR__ . '/../controllers/DotEnvLoader.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT');
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
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Get action from appropriate source based on method
    if ($method === 'POST') {
        $action = $_POST['action'] ?? $_GET['action'] ?? '';
    } else {
        $action = $_GET['action'] ?? '';
    }
    
    // Get authenticated dealer ID
    $dealerId = $_SESSION['dealer_id'] ?? null;
    
    if (!$dealerId) {
        throw new Exception('Dealer authentication required');
    }
    
    // Debug logging
    error_log("City Proxy API - Method: $method, Action: $action, Dealer ID: $dealerId");
    
    switch ($method) {
        case 'GET':
            handleGetRequest($action, $dealerId);
            break;
            
        case 'POST':
            handlePostRequest($action, $dealerId);
            break;
            
        default:
            throw new Exception('Method not allowed');
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Handle GET requests
 */
function handleGetRequest($action, $dealerId)
{
    switch ($action) {
        case 'search_cities':
            searchCities();
            break;
            
        case 'get_suggestions':
            getSmartSuggestions($dealerId);
            break;
            
        case 'get_current_city':
            getCurrentCity($dealerId);
            break;
            
        case 'test_city':
            testCityProxy();
            break;
            
        default:
            throw new Exception('Invalid action');
    }
}

/**
 * Handle POST requests
 */
function handlePostRequest($action, $dealerId)
{
    // Handle both JSON and form data
    $input = null;
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    
    if (strpos($contentType, 'application/json') !== false) {
        $input = json_decode(file_get_contents('php://input'), true);
    } else {
        $input = $_POST;
    }
    
    // Debug logging
    error_log("POST Request - Action: $action, Content-Type: $contentType, Input: " . json_encode($input));
    
    switch ($action) {
        case 'select_city':
            selectCity($dealerId, $input);
            break;
            
        case 'set_favorite':
            setFavoriteCity($dealerId, $input);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
}

/**
 * Search for available cities
 */
function searchCities()
{
    $search = $_GET['search'] ?? '';
    $limit = intval($_GET['limit'] ?? 20);
    
    $cities = CityProxyManager::getAvailableCities($search, $limit);
    
    echo json_encode([
        'success' => true,
        'cities' => $cities,
        'search_term' => $search,
        'total_results' => count($cities)
    ]);
}

/**
 * Get smart city suggestions for dealer
 */
function getSmartSuggestions($dealerId)
{
    $suggestions = CityProxyManager::getSmartSuggestions($dealerId);
    
    echo json_encode([
        'success' => true,
        'suggestions' => $suggestions,
        'dealer_id' => $dealerId
    ]);
}

/**
 * Get current selected city for dealer
 */
function getCurrentCity($dealerId)
{
    $currentCity = CityProxyManager::getDealerSelectedCity($dealerId);
    
    // Get city display name
    $cities = CityProxyManager::getAvailableCities($currentCity, 1);
    $displayName = !empty($cities) ? $cities[0]['display_name'] : CityProxyManager::formatCityDisplayName($currentCity);
    
    // Get current proxy configuration
    $proxyConfig = DotEnvLoader::getOxylabsConfig();
    
    echo json_encode([
        'success' => true,
        'current_city' => [
            'city_name' => $currentCity,
            'display_name' => $displayName,
            'is_default' => false
        ],
        'proxy_config' => [
            'host' => $proxyConfig['host'],
            'port' => $proxyConfig['port'],
            'location' => $proxyConfig['location'],
            'enabled' => $proxyConfig['enabled']
        ],
        'dealer_id' => $dealerId
    ]);
}

/**
 * Test a specific city proxy connection
 */
function testCityProxy()
{
    $cityName = $_GET['city'] ?? '';
    
    if (empty($cityName)) {
        throw new Exception('City name is required for testing');
    }
    
    // Validate city
    if (!CityProxyManager::validateCity($cityName)) {
        throw new Exception('Invalid or unavailable city: ' . $cityName);
    }
    
    // Test the proxy connection
    $testResult = testProxyConnection($cityName);
    
    echo json_encode([
        'success' => $testResult['success'],
        'city' => $cityName,
        'test_result' => $testResult,
        'timestamp' => time()
    ]);
}

/**
 * Select a city for the dealer
 */
function selectCity($dealerId, $input)
{
    $cityName = $input['city_name'] ?? $input['city'] ?? '';
    
    if (empty($cityName)) {
        throw new Exception('City name is required');
    }
    
    $success = CityProxyManager::setDealerCity($dealerId, $cityName, false);
    
    if (!$success) {
        throw new Exception('Failed to select city');
    }
    
    // Clear proxy session before setting new city
    try {
        require_once __DIR__ . '/../controllers/SessionProxyManager.php';
        SessionProxyManager::clearSessionProxyInfo();
        unset($_SESSION['selected_proxy_city']);
        $_SESSION['login_time'] = time(); // Force new session
        error_log("Cleared proxy session before setting new city: $cityName");
    } catch (Exception $e) {
        error_log("Could not clear proxy session: " . $e->getMessage());
    }
    
    // Update session with selected city
    DotEnvLoader::setSelectedProxyCity($cityName);
    
    // Get updated proxy configuration (should now reflect the new city)
    $proxyConfig = DotEnvLoader::getOxylabsConfig();
    
    // Get city display name
    $cities = CityProxyManager::getAvailableCities($cityName, 1);
    $displayName = !empty($cities) ? $cities[0]['display_name'] : CityProxyManager::formatCityDisplayName($cityName);
    
    echo json_encode([
        'success' => true,
        'message' => 'City selected successfully',
        'selected_city' => [
            'city_name' => $cityName,
            'display_name' => $displayName
        ],
        'proxy_config' => [
            'host' => $proxyConfig['host'],
            'port' => $proxyConfig['port'],
            'location' => $proxyConfig['location'],
            'username' => $proxyConfig['username'],
            'enabled' => $proxyConfig['enabled']
        ],
        'dealer_id' => $dealerId,
        'session_updated' => true
    ]);
}

/**
 * Set a city as favorite for the dealer
 */
function setFavoriteCity($dealerId, $input)
{
    $cityName = $input['city_name'] ?? '';
    $isFavorite = $input['is_favorite'] ?? true;
    
    if (empty($cityName)) {
        throw new Exception('City name is required');
    }
    
    $success = CityProxyManager::setDealerCity($dealerId, $cityName, $isFavorite);
    
    if (!$success) {
        throw new Exception('Failed to set city as favorite');
    }
    
    echo json_encode([
        'success' => true,
        'message' => $isFavorite ? 'City added to favorites' : 'City removed from favorites',
        'city_name' => $cityName,
        'is_favorite' => $isFavorite,
        'dealer_id' => $dealerId
    ]);
}

/**
 * Test proxy connection for a specific city
 */
function testProxyConnection($cityName)
{
    try {
        $proxyConfig = CityProxyManager::getCityProxyConfig($cityName);
        
        if (!$proxyConfig['enabled']) {
            return [
                'success' => false,
                'message' => 'Proxy is not enabled'
            ];
        }
        
        $startTime = microtime(true);
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://ip.oxylabs.io/location',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_PROXY => $proxyConfig['host'] . ':' . $proxyConfig['port'],
            CURLOPT_PROXYUSERPWD => $proxyConfig['username'] . ':' . $proxyConfig['password'],
            CURLOPT_PROXYTYPE => CURLPROXY_HTTP,
            CURLOPT_HTTPPROXYTUNNEL => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        $responseTime = microtime(true) - $startTime;

        if ($error) {
            return [
                'success' => false,
                'message' => 'Connection failed: ' . $error,
                'response_time' => $responseTime
            ];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'message' => 'HTTP Error: ' . $httpCode,
                'response_time' => $responseTime
            ];
        }

        $data = json_decode($response, true);
        
        return [
            'success' => true,
            'message' => 'Connection successful',
            'ip' => $data['ip'] ?? 'Unknown',
            'location' => $data['location'] ?? $cityName,
            'response_time' => $responseTime,
            'proxy_config' => [
                'host' => $proxyConfig['host'],
                'port' => $proxyConfig['port'],
                'location' => $proxyConfig['location']
            ]
        ];

    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Test failed: ' . $e->getMessage()
        ];
    }
}

?> 
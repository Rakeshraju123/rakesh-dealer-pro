<?php

require_once __DIR__ . '/../controllers/DotEnvLoader.php';
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
    
    $facebookUrl = $input['facebook_url'] ?? 'https://www.facebook.com/marketplace/create/vehicle';
    $trailerData = $input['trailer_data'] ?? null;
    
    // Get proxy configuration
    $proxyConfig = DotEnvLoader::getOxylabsConfig();
    $proxyIp = DotEnvLoader::getProxyIp();
    
    if (!$proxyConfig['enabled']) {
        throw new Exception('Proxy is not enabled');
    }
    
    // Create a specialized Facebook launcher using DynamicScraper
    $facebookLauncher = new FacebookProxyLauncher();
    
    // Launch Facebook with proxy
    $result = $facebookLauncher->launchFacebookWithProxy($facebookUrl, $trailerData);
    
    // Return response with proxy information
    echo json_encode([
        'success' => true,
        'facebook_url' => $facebookUrl,
        'proxy_info' => [
            'enabled' => $proxyConfig['enabled'],
            'ip' => $proxyIp,
            'host' => $proxyConfig['host'],
            'port' => $proxyConfig['port'],
            'location' => $proxyConfig['location']
        ],
        'launcher_result' => $result,
        'message' => 'Facebook Marketplace launched through Kansas City proxy'
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Facebook Proxy Launcher class
 */
class FacebookProxyLauncher extends DynamicScraper
{
    public function launchFacebookWithProxy($facebookUrl, $trailerData = null)
    {
        try {
            // Start WebDriver with proxy configuration (using reflection to access private method)
            $reflection = new ReflectionClass($this);
            $startWebDriverMethod = $reflection->getMethod('startWebDriver');
            $startWebDriverMethod->setAccessible(true);
            $startWebDriverMethod->invoke($this);
            
            // Navigate to Facebook Marketplace
            $this->driver->get($facebookUrl);
            
            // Wait for page to load
            $wait = new Facebook\WebDriver\WebDriverWait($this->driver, 10);
            $wait->until(Facebook\WebDriver\WebDriverExpectedCondition::presenceOfElementLocated(
                Facebook\WebDriver\WebDriverBy::tagName('body')
            ));
            
            // Get current IP to verify proxy is working
            $currentIp = $this->verifyProxyIP();
            
            // Store session information
            $sessionData = [
                'facebook_url' => $facebookUrl,
                'trailer_data' => $trailerData,
                'proxy_ip' => $currentIp,
                'launched_at' => time()
            ];
            
            // Keep the browser open for user interaction
            // Note: In a real implementation, you might want to handle this differently
            
            return [
                'status' => 'launched',
                'proxy_ip' => $currentIp,
                'session_data' => $sessionData
            ];
            
        } catch (Exception $e) {
            $this->logger->error('Facebook launch failed', [
                'error' => $e->getMessage(),
                'facebook_url' => $facebookUrl
            ]);
            
            throw new Exception('Failed to launch Facebook through proxy: ' . $e->getMessage());
        }
    }
    
    /**
     * Verify proxy IP by checking current IP
     */
    private function verifyProxyIP()
    {
        try {
            // Navigate to IP checker
            $this->driver->get('https://ip.oxylabs.io/location');
            
            // Wait for page to load
            $wait = new Facebook\WebDriver\WebDriverWait($this->driver, 10);
            $wait->until(Facebook\WebDriver\WebDriverExpectedCondition::presenceOfElementLocated(
                Facebook\WebDriver\WebDriverBy::tagName('body')
            ));
            
            // Get page source and extract IP
            $pageSource = $this->driver->getPageSource();
            
            if (preg_match('/"ip"\s*:\s*"([^"]+)"/', $pageSource, $matches)) {
                return $matches[1];
            }
            
            return null;
            
        } catch (Exception $e) {
            $this->logger->error('Failed to verify proxy IP', [
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }
}

?> 
<?php

// show all errors
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../../vendor/autoload.php';

use Dotenv\Dotenv;

class DotEnvLoader {
    public static function load() {
        $dotenv = Dotenv::createImmutable(__DIR__ . '/../../');
        $dotenv->load();
        
        // Set the WebDriver ChromeDriver path for the PHP WebDriver library
        $chromedriverPath = self::getChromedriverPath();
        if ($chromedriverPath) {
            putenv("WEBDRIVER_CHROME_DRIVER=" . $chromedriverPath);
            $_ENV['WEBDRIVER_CHROME_DRIVER'] = $chromedriverPath;
        }
    }

    public static function get($key) {
        return $_ENV[$key];
    }

    public static function getOpenAiApiKey() {
        return $_ENV['OPENAI_API_KEY'];
    }

    /**
     * Get Oxylabs proxy configuration with dynamic city selection
     */
    public static function getOxylabsConfig() {
        // Get selected city from session
        $selectedCity = self::getSelectedProxyCity();
        
        if (!$selectedCity) {
            // Return disabled config if no city is selected
            return [
                'username' => null,
                'password' => $_ENV['OXYLABS_PASSWORD'] ?? 'MJ96YF6jedT=',
                'host' => $_ENV['OXYLABS_HOST'] ?? 'pr.oxylabs.io',
                'port' => $_ENV['OXYLABS_PORT'] ?? '7777',
                'location' => null,
                'enabled' => false
            ];
        }
        
        return [
            'username' => $_ENV['OXYLABS_USERNAME'] ?? 'customer-testtest_2lYYo-cc-US-city-' . $selectedCity,
            'password' => $_ENV['OXYLABS_PASSWORD'] ?? 'MJ96YF6jedT=',
            'host' => $_ENV['OXYLABS_HOST'] ?? 'pr.oxylabs.io',
            'port' => $_ENV['OXYLABS_PORT'] ?? '7777',
            'location' => $_ENV['OXYLABS_LOCATION'] ?? $selectedCity,
            'enabled' => filter_var($_ENV['OXYLABS_ENABLED'] ?? 'true', FILTER_VALIDATE_BOOLEAN)
        ];
    }
    
    /**
     * Get the currently selected proxy city
     */
    public static function getSelectedProxyCity() {
        // Start session if not already started
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Check session first
        if (isset($_SESSION['selected_proxy_city'])) {
            return $_SESSION['selected_proxy_city'];
        }
        
        // Try to get from CityProxyManager if available
        if (class_exists('CityProxyManager') && isset($_SESSION['dealer_id'])) {
            try {
                require_once __DIR__ . '/CityProxyManager.php';
                $selectedCity = CityProxyManager::getDealerSelectedCity($_SESSION['dealer_id']);
                $_SESSION['selected_proxy_city'] = $selectedCity;
                return $selectedCity;
            } catch (Exception $e) {
                error_log("Error getting dealer selected city: " . $e->getMessage());
            }
        }
        
        // No fallback - return null if no city is selected
        error_log("Warning: No proxy city selected, returning null");
        return null;
    }
    
    /**
     * Set the selected proxy city in session
     */
    public static function setSelectedProxyCity($cityName) {
        // Start session if not already started
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $_SESSION['selected_proxy_city'] = $cityName;
        error_log("Updated session proxy city to: $cityName");
    }

    /**
     * Get ChromeDriver path from environment or return system default
     */
    public static function getChromedriverPath() {
        // Check for the standard WebDriver environment variable first
        $path = $_ENV['WEBDRIVER_CHROME_DRIVER'] ?? null;
        
        // Fallback to our custom environment variable
        if (!$path) {
            $path = $_ENV['CHROMEDRIVER_PATH'] ?? null;
        }
        
        // Final fallback to system-wide installation
        if (!$path) {
            $path = '/usr/local/bin/chromedriver';
        }
        
        return $path;
    }

    /**
     * Get current proxy IP address from Kansas City
     * Now uses session-based proxy management to prevent Facebook account blocks
     */
    public static function getProxyIp() {
        // Try to use session-based proxy first
        require_once __DIR__ . '/SessionProxyManager.php';
        
        $sessionProxyIP = SessionProxyManager::getSessionProxyIP();
        if ($sessionProxyIP) {
            return $sessionProxyIP;
        }
        
        // Fallback to old method if session proxy is not available
        return self::getRotatingProxyIp();
    }
    
    /**
     * Get rotating proxy IP (old method) - used as fallback
     */
    public static function getRotatingProxyIp() {
        $config = self::getOxylabsConfig();
        
        if (!$config['enabled']) {
            return null;
        }

        // Try to use the session's unique username if available
        $username = $config['username'];
        if (session_status() !== PHP_SESSION_NONE && isset($_SESSION['dealer_proxy_session']['unique_username'])) {
            $username = $_SESSION['dealer_proxy_session']['unique_username'];
            error_log("DotEnvLoader: Using session unique username: " . $username);
        }

        try {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => 'https://ip.oxylabs.io/location',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_PROXY => $config['host'] . ':' . $config['port'],
                CURLOPT_PROXYUSERPWD => $username . ':' . $config['password'],
                CURLOPT_PROXYTYPE => CURLPROXY_HTTP,
                CURLOPT_HTTPPROXYTUNNEL => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                error_log("Proxy IP fetch error: " . $error);
                return null;
            }

            if ($httpCode !== 200) {
                error_log("Proxy IP fetch failed with HTTP code: " . $httpCode);
                return null;
            }

            $data = json_decode($response, true);
            return $data['ip'] ?? null;

        } catch (Exception $e) {
            error_log("Exception fetching proxy IP: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Test proxy connection with Kansas City endpoint
     */
    public static function testProxyConnection() {
        $config = self::getOxylabsConfig();
        
        if (!$config['enabled']) {
            return [
                'success' => false,
                'message' => 'Proxy is disabled in configuration'
            ];
        }

        try {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => 'https://ip.oxylabs.io/location',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_PROXY => $config['host'] . ':' . $config['port'],
                CURLOPT_PROXYUSERPWD => $config['username'] . ':' . $config['password'],
                CURLOPT_PROXYTYPE => CURLPROXY_HTTP,
                CURLOPT_HTTPPROXYTUNNEL => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                CURLOPT_VERBOSE => false
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            $info = curl_getinfo($ch);
            curl_close($ch);

            if ($error) {
                return [
                    'success' => false,
                    'message' => 'Proxy connection failed: ' . $error,
                    'error' => $error
                ];
            }

            if ($httpCode !== 200) {
                return [
                    'success' => false,
                    'message' => 'Proxy request failed with HTTP code: ' . $httpCode,
                    'http_code' => $httpCode,
                    'response' => $response
                ];
            }

            $data = json_decode($response, true);
            $ip = $data['ip'] ?? null;
            $location = $data['location'] ?? null;

            return [
                'success' => true,
                'message' => 'Proxy connection successful',
                'ip' => $ip,
                'location' => $location,
                'config' => [
                    'host' => $config['host'],
                    'port' => $config['port'],
                    'username' => $config['username'],
                    'location' => $config['location']
                ],
                'response_time' => $info['total_time'] ?? 0
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Exception during proxy test: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ];
        }
    }
}